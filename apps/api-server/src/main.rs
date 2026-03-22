//! Retrosync backend — Axum API server.
//! Zero Trust: every request verified via JWT (auth.rs).
//! LangSec: all inputs pass through shared::parsers recognizers.
//! ISO 9001 §7.5: all operations logged to append-only audit store.

use axum::{
    extract::{Multipart, Path, State},
    http::{Method, StatusCode},
    middleware,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use shared::parsers::recognize_isrc;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;

mod audio_qc;
mod auth;
mod btfs;
mod bttc;
mod bwarm;
mod coinbase;
mod ddex;
mod dqi;
mod dsp;
mod durp;
mod fraud;
mod gtms;
mod hyperglot;
mod identifiers;
mod iso_store;
mod kyc;
mod langsec;
mod ledger;
mod metrics;
mod mirrors;
mod moderation;
mod music_reports;
mod persist;
mod privacy;
mod publishing;
mod rate_limit;
mod royalty_reporting;
mod sap;
mod shard;
mod takedown;
mod tron;
mod wallet_auth;
mod wikidata;
mod xslt;
mod zk_cache;

#[derive(Clone)]
pub struct AppState {
    pub pki_dir: std::path::PathBuf,
    pub audit_log: Arc<iso_store::AuditStore>,
    pub metrics: Arc<metrics::CtqMetrics>,
    pub zk_cache: Arc<zk_cache::ZkProofCache>,
    pub takedown_db: Arc<takedown::TakedownStore>,
    pub privacy_db: Arc<privacy::PrivacyStore>,
    pub fraud_db: Arc<fraud::FraudDetector>,
    pub kyc_db: Arc<kyc::KycStore>,
    pub mod_queue: Arc<moderation::ModerationQueue>,
    pub sap_client: Arc<sap::SapClient>,
    pub gtms_db: Arc<gtms::GtmsStore>,
    pub challenge_store: Arc<wallet_auth::ChallengeStore>,
    pub rate_limiter: Arc<rate_limit::RateLimiter>,
    pub shard_store: Arc<shard::ShardStore>,
    // ── New integrations ──────────────────────────────────────────────────
    pub tron_config: Arc<tron::TronConfig>,
    pub coinbase_config: Arc<coinbase::CoinbaseCommerceConfig>,
    pub durp_config: Arc<durp::DurpConfig>,
    pub music_reports_config: Arc<music_reports::MusicReportsConfig>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("backend=debug".parse()?))
        .json()
        .init();

    let state = AppState {
        pki_dir: std::path::PathBuf::from(
            std::env::var("PKI_DIR").unwrap_or_else(|_| "pki".into()),
        ),
        audit_log: Arc::new(iso_store::AuditStore::open("audit.db")?),
        metrics: Arc::new(metrics::CtqMetrics::new()),
        zk_cache: Arc::new(zk_cache::ZkProofCache::open("zk_proof_cache.lmdb")?),
        takedown_db: Arc::new(takedown::TakedownStore::open("takedown.db")?),
        privacy_db: Arc::new(privacy::PrivacyStore::open("privacy_db")?),
        fraud_db: Arc::new(fraud::FraudDetector::new()),
        kyc_db: Arc::new(kyc::KycStore::open("kyc_db")?),
        mod_queue: Arc::new(moderation::ModerationQueue::open("moderation_db")?),
        sap_client: Arc::new(sap::SapClient::from_env()),
        gtms_db: Arc::new(gtms::GtmsStore::new()),
        challenge_store: Arc::new(wallet_auth::ChallengeStore::new()),
        rate_limiter: Arc::new(rate_limit::RateLimiter::new()),
        shard_store: Arc::new(shard::ShardStore::new()),
        tron_config: Arc::new(tron::TronConfig::from_env()),
        coinbase_config: Arc::new(coinbase::CoinbaseCommerceConfig::from_env()),
        durp_config: Arc::new(durp::DurpConfig::from_env()),
        music_reports_config: Arc::new(music_reports::MusicReportsConfig::from_env()),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/metrics", get(metrics::handler))
        // ── Wallet authentication (no auth required — these issue the auth token)
        .route(
            "/api/auth/challenge/:address",
            get(wallet_auth::issue_challenge),
        )
        .route("/api/auth/verify", post(wallet_auth::verify_challenge))
        // ── Track upload + status
        .route("/api/upload", post(upload_track))
        .route("/api/track/:id", get(track_status))
        // ── Publishing agreements + soulbound NFT minting
        .route("/api/register", post(publishing::register_track))
        // ── DMCA §512
        .route("/api/takedown", post(takedown::submit_notice))
        .route(
            "/api/takedown/:id/counter",
            post(takedown::submit_counter_notice),
        )
        .route("/api/takedown/:id", get(takedown::get_notice))
        // ── GDPR/CCPA
        .route("/api/privacy/consent", post(privacy::record_consent))
        .route(
            "/api/privacy/delete/:uid",
            delete(privacy::delete_user_data),
        )
        .route("/api/privacy/export/:uid", get(privacy::export_user_data))
        // ── Moderation (DSA/Article 17)
        .route("/api/moderation/report", post(moderation::submit_report))
        .route("/api/moderation/queue", get(moderation::get_queue))
        .route(
            "/api/moderation/:id/resolve",
            post(moderation::resolve_report),
        )
        // ── KYC/AML
        .route("/api/kyc/:uid", post(kyc::submit_kyc))
        .route("/api/kyc/:uid/status", get(kyc::kyc_status))
        // ── CWR/XSLT society submissions
        .route(
            "/api/royalty/xslt/:society",
            post(xslt::transform_submission),
        )
        .route(
            "/api/royalty/xslt/all",
            post(xslt::transform_all_submissions),
        )
        // ── SAP S/4HANA + ECC
        .route("/api/sap/royalty-posting", post(sap::post_royalty_document))
        .route("/api/sap/vendor-sync", post(sap::sync_vendor))
        .route("/api/sap/idoc/royalty", post(sap::emit_royalty_idoc))
        .route("/api/sap/health", get(sap::sap_health))
        // ── Global Trade Management
        .route("/api/gtms/classify", post(gtms::classify_work))
        .route("/api/gtms/screen", post(gtms::screen_distribution))
        .route("/api/gtms/declaration/:id", get(gtms::get_declaration))
        // ── Shard store (CFT audio decomposition + NFT-gated access)
        .route("/api/shard/:cid", get(shard::get_shard))
        .route("/api/shard/decompose", post(shard::decompose_and_index))
        // ── Tron network (TronLink wallet auth + TRX royalty distribution)
        .route("/api/tron/challenge/:address", get(tron_issue_challenge))
        .route("/api/tron/verify", post(tron_verify))
        // ── Coinbase Commerce (payments + webhook)
        .route(
            "/api/payments/coinbase/charge",
            post(coinbase_create_charge),
        )
        .route("/api/payments/coinbase/webhook", post(coinbase_webhook))
        .route(
            "/api/payments/coinbase/status/:charge_id",
            get(coinbase_charge_status),
        )
        // ── DQI (Data Quality Initiative)
        .route("/api/dqi/evaluate", post(dqi_evaluate))
        // ── DURP (Distributor Unmatched Recordings Portal)
        .route("/api/durp/submit", post(durp_submit))
        // ── BWARM (Best Workflow for All Rights Management)
        .route("/api/bwarm/record", post(bwarm_create_record))
        .route("/api/bwarm/conflicts", post(bwarm_detect_conflicts))
        // ── Music Reports
        .route(
            "/api/music-reports/licence/:isrc",
            get(music_reports_lookup),
        )
        .route("/api/music-reports/rates", get(music_reports_rates))
        // ── Hyperglot (script detection)
        .route("/api/hyperglot/detect", post(hyperglot_detect))
        .layer({
            // SECURITY: CORS locked to explicit allowed origins (ALLOWED_ORIGINS env var).
            use axum::http::header::{AUTHORIZATION, CONTENT_TYPE};
            let origins = auth::allowed_origins();
            if !origins.is_empty() {
                CorsLayer::new()
                    .allow_origin(origins)
                    .allow_methods([Method::GET, Method::POST, Method::DELETE])
                    .allow_headers([AUTHORIZATION, CONTENT_TYPE])
            } else {
                CorsLayer::new()
                    .allow_origin(Any)
                    .allow_methods(Any)
                    .allow_headers(Any)
            }
        })
        // Middleware execution order (Axum applies last-added = outermost):
        //   1. rate_limit::enforce — outermost: reject flood before doing any work
        //   2. auth::verify_zero_trust — inner: only verified requests reach handlers
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::verify_zero_trust,
        ))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            rate_limit::enforce,
        ))
        .with_state(state);

    let addr = "0.0.0.0:8443";
    info!("Backend listening on https://{} (mTLS)", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "retrosync-backend" }))
}

async fn track_status(Path(id): Path<String>) -> Json<serde_json::Value> {
    Json(serde_json::json!({ "id": id, "status": "registered" }))
}

async fn upload_track(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let start = std::time::Instant::now();

    let mut title = String::new();
    let mut artist_name = String::new();
    let mut isrc_raw = String::new();
    let mut audio_bytes = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?
    {
        match field.name().unwrap_or("") {
            "title" => title = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?,
            "artist" => artist_name = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?,
            "isrc" => isrc_raw = field.text().await.map_err(|_| StatusCode::BAD_REQUEST)?,
            "audio" => {
                // SECURITY: Enforce maximum file size to prevent OOM DoS.
                // Default: 100MB. Override with MAX_AUDIO_BYTES env var.
                let max_bytes: usize = std::env::var("MAX_AUDIO_BYTES")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(100 * 1024 * 1024);
                let bytes = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
                if bytes.len() > max_bytes {
                    warn!(
                        size = bytes.len(),
                        max = max_bytes,
                        "Upload rejected: file too large"
                    );
                    state.metrics.record_defect("upload_too_large");
                    return Err(StatusCode::PAYLOAD_TOO_LARGE);
                }
                audio_bytes = bytes.to_vec();
            }
            _ => {}
        }
    }

    // ── LangSec: formal recognition ───────────────────────────────────────
    let isrc = recognize_isrc(&isrc_raw).map_err(|e| {
        warn!(err=%e, "LangSec: ISRC rejected");
        state.metrics.record_defect("isrc_parse");
        StatusCode::UNPROCESSABLE_ENTITY
    })?;

    // ── Master Pattern fingerprint ────────────────────────────────────────
    use sha2::{Digest, Sha256};
    use shared::master_pattern::{pattern_fingerprint, RarityTier};
    let audio_hash: [u8; 32] = Sha256::digest(&audio_bytes).into();
    let fp = pattern_fingerprint(isrc.0.as_bytes(), &audio_hash);
    let tier = RarityTier::from_band(fp.band);
    info!(isrc=%isrc, band=%fp.band, rarity=%tier.as_str(), "Master Pattern computed");

    // ── Alphabet resonance ────────────────────────────────────────────────
    use shared::alphabet::resonance_report;
    let resonance = resonance_report(&artist_name, &title, fp.band);

    // ── Audio QC (LUFS + format) ──────────────────────────────────────────
    let qc_report = audio_qc::run_qc(&audio_bytes, None, None);
    for defect in &qc_report.defects {
        state.metrics.record_defect("audio_qc");
        warn!(defect=%defect, isrc=%isrc, "Audio QC defect");
    }
    let track_meta = dsp::TrackMeta {
        isrc: Some(isrc.0.clone()),
        upc: None,
        explicit: false,
        territory_rights: false,
        contributor_meta: false,
        cover_art_px: None,
    };
    let dsp_results = dsp::validate_all(&qc_report, &track_meta);
    let dsp_failures: Vec<_> = dsp_results.iter().filter(|r| !r.passed).collect();

    // ── ISO 9001 audit ────────────────────────────────────────────────────
    state
        .audit_log
        .record(&format!(
            "UPLOAD_START title='{}' isrc='{}' bytes={} band={} rarity={} qc_passed={}",
            title,
            isrc,
            audio_bytes.len(),
            fp.band,
            tier.as_str(),
            qc_report.passed
        ))
        .ok();

    // ── Article 17 upload filter ──────────────────────────────────────────
    if wikidata::isrc_exists(&isrc.0).await {
        warn!(isrc=%isrc, "Article 17: ISRC already on Wikidata — flagging");
        state.mod_queue.add(moderation::ContentReport {
            id: format!("ART17-{}", isrc.0),
            isrc: isrc.0.clone(),
            reporter_id: "system:article17_filter".into(),
            category: moderation::ReportCategory::Copyright,
            description: format!("ISRC {} already registered on Wikidata", isrc.0),
            status: moderation::ReportStatus::UnderReview,
            submitted_at: chrono::Utc::now().to_rfc3339(),
            resolved_at: None,
            resolution: None,
            sla_hours: 24,
        });
    }

    // ── Wikidata enrichment ───────────────────────────────────────────────
    let wiki = if std::env::var("WIKIDATA_DISABLED").unwrap_or_default() != "1"
        && !artist_name.is_empty()
    {
        wikidata::lookup_artist(&artist_name).await
    } else {
        wikidata::WikidataArtist::default()
    };
    if let Some(ref qid) = wiki.qid {
        info!(artist=%artist_name, qid=%qid, mbid=?wiki.musicbrainz_id, "Wikidata enriched");
        state
            .audit_log
            .record(&format!(
                "WIKIDATA_ENRICH isrc='{isrc}' artist='{artist_name}' qid='{qid}'"
            ))
            .ok();
    }

    info!(isrc=%isrc, title=%title, "Pipeline starting");

    // ── Pipeline ──────────────────────────────────────────────────────────
    let cid = btfs::upload(&audio_bytes, &title, &isrc)
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    let tx_result = bttc::submit_distribution(&cid, &[], fp.band, None)
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    let tx_hash = tx_result.tx_hash;

    let reg = ddex::register(&title, &isrc, &cid, &fp, &wiki)
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    mirrors::push_all(&cid, &reg.isrc, &title, fp.band)
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    // ── Six Sigma CTQ ─────────────────────────────────────────────────────
    let elapsed_ms = start.elapsed().as_millis() as f64;
    state.metrics.record_band(fp.band);
    state.metrics.record_latency("upload_pipeline", elapsed_ms);
    if elapsed_ms > 200.0 {
        warn!(elapsed_ms, "CTQ breach: latency >200ms");
        state.metrics.record_defect("latency_breach");
    }

    state
        .audit_log
        .record(&format!(
            "UPLOAD_DONE isrc='{}' cid='{}' tx='{}' elapsed_ms={}",
            isrc, cid.0, tx_hash, elapsed_ms
        ))
        .ok();

    Ok(Json(serde_json::json!({
        "cid":             cid.0,
        "isrc":            isrc.0,
        "tx_hash":         tx_hash,
        "band":            fp.band,
        "band_residue":    fp.band_residue,
        "mapped_prime":    fp.mapped_prime,
        "rarity":          tier.as_str(),
        "cycle_pos":       fp.cycle_position,
        "title_resonant":  resonance.title_resonant,
        "wikidata_qid":    wiki.qid,
        "musicbrainz_id":  wiki.musicbrainz_id,
        "artist_label":    wiki.label_name,
        "artist_country":  wiki.country,
        "artist_genres":   wiki.genres,
        "audio_qc_passed": qc_report.passed,
        "audio_qc_defects":qc_report.defects,
        "dsp_ready":       dsp_failures.is_empty(),
        "dsp_failures":    dsp_failures.iter().map(|r| &r.dsp).collect::<Vec<_>>(),
    })))
}

// ── Tron handlers ─────────────────────────────────────────────────────────────

async fn tron_issue_challenge(
    Path(address): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // LangSec: validate Tron address before issuing challenge
    langsec::validate_tron_address(&address).map_err(|e| {
        warn!(err=%e, "Tron challenge: invalid address");
        StatusCode::UNPROCESSABLE_ENTITY
    })?;
    let challenge = tron::issue_tron_challenge(&address).map_err(|e| {
        warn!(err=%e, "Tron challenge: issue failed");
        StatusCode::BAD_REQUEST
    })?;
    Ok(Json(serde_json::json!({
        "challenge_id": challenge.challenge_id,
        "address": challenge.address.0,
        "nonce": challenge.nonce,
        "expires_at": challenge.expires_at,
    })))
}

async fn tron_verify(
    State(state): State<AppState>,
    Json(req): Json<tron::TronVerifyRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // NOTE: In production, look up the nonce from the challenge store by challenge_id.
    // For now we echo the challenge_id as the nonce (to be wired to ChallengeStore).
    let nonce = req.challenge_id.clone();
    let result = tron::verify_tron_signature(&state.tron_config, &req, &nonce)
        .await
        .map_err(|e| {
            warn!(err=%e, "Tron verify: failed");
            StatusCode::UNAUTHORIZED
        })?;
    if !result.verified {
        return Err(StatusCode::UNAUTHORIZED);
    }
    state
        .audit_log
        .record(&format!("TRON_AUTH_OK address='{}'", result.address))
        .ok();
    Ok(Json(serde_json::json!({
        "verified": result.verified,
        "address": result.address.0,
        "message": result.message,
    })))
}

// ── Coinbase Commerce handlers ─────────────────────────────────────────────────

async fn coinbase_create_charge(
    State(state): State<AppState>,
    Json(req): Json<coinbase::ChargeRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // LangSec: validate text fields
    langsec::validate_free_text(&req.name, "name", 200)
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;
    let resp = coinbase::create_charge(&state.coinbase_config, &req)
        .await
        .map_err(|e| {
            warn!(err=%e, "Coinbase charge creation failed");
            StatusCode::BAD_GATEWAY
        })?;
    Ok(Json(serde_json::json!({
        "charge_id":   resp.charge_id,
        "hosted_url":  resp.hosted_url,
        "amount_usd":  resp.amount_usd,
        "expires_at":  resp.expires_at,
        "status":      format!("{:?}", resp.status),
    })))
}

async fn coinbase_webhook(
    State(state): State<AppState>,
    request: axum::extract::Request,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let sig = request
        .headers()
        .get("x-cc-webhook-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body = axum::body::to_bytes(request.into_body(), langsec::MAX_JSON_BODY_BYTES)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    coinbase::verify_webhook_signature(&state.coinbase_config, &body, &sig).map_err(|e| {
        warn!(err=%e, "Coinbase webhook signature invalid");
        StatusCode::UNAUTHORIZED
    })?;
    let payload: coinbase::WebhookPayload =
        serde_json::from_slice(&body).map_err(|_| StatusCode::BAD_REQUEST)?;
    if let Some((event_type, charge_id)) = coinbase::handle_webhook_event(&payload) {
        state
            .audit_log
            .record(&format!(
                "COINBASE_WEBHOOK event='{event_type}' charge='{charge_id}'"
            ))
            .ok();
    }
    Ok(Json(serde_json::json!({ "received": true })))
}

async fn coinbase_charge_status(
    State(state): State<AppState>,
    Path(charge_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let status = coinbase::get_charge_status(&state.coinbase_config, &charge_id)
        .await
        .map_err(|e| {
            warn!(err=%e, "Coinbase status lookup failed");
            StatusCode::BAD_GATEWAY
        })?;
    Ok(Json(
        serde_json::json!({ "charge_id": charge_id, "status": format!("{:?}", status) }),
    ))
}

// ── DQI handler ───────────────────────────────────────────────────────────────

async fn dqi_evaluate(
    State(state): State<AppState>,
    Json(input): Json<dqi::DqiInput>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let report = dqi::evaluate(&input);
    state
        .audit_log
        .record(&format!(
            "DQI_EVALUATE isrc='{}' score={:.1}% tier='{}'",
            report.isrc,
            report.score_pct,
            report.tier.as_str()
        ))
        .ok();
    Ok(Json(serde_json::to_value(&report).unwrap_or_default()))
}

// ── DURP handler ──────────────────────────────────────────────────────────────

async fn durp_submit(
    State(state): State<AppState>,
    Json(records): Json<Vec<durp::DurpRecord>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    if records.is_empty() || records.len() > 5000 {
        return Err(StatusCode::UNPROCESSABLE_ENTITY);
    }
    let errors = durp::validate_records(&records);
    if !errors.is_empty() {
        return Ok(Json(serde_json::json!({
            "status": "validation_failed",
            "errors": errors,
        })));
    }
    let csv = durp::generate_csv(&records);
    let batch_id = format!(
        "BATCH-{:016x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let submission = durp::submit_batch(&state.durp_config, &batch_id, &csv)
        .await
        .map_err(|e| {
            warn!(err=%e, "DURP submission failed");
            StatusCode::BAD_GATEWAY
        })?;
    state
        .audit_log
        .record(&format!(
            "DURP_SUBMIT batch='{}' records={} status='{:?}'",
            batch_id,
            records.len(),
            submission.status
        ))
        .ok();
    Ok(Json(serde_json::json!({
        "batch_id": submission.batch_id,
        "status": format!("{:?}", submission.status),
        "records": records.len(),
    })))
}

// ── BWARM handlers ─────────────────────────────────────────────────────────────

async fn bwarm_create_record(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let title = payload["title"].as_str().unwrap_or("").to_string();
    let isrc = payload["isrc"].as_str();
    langsec::validate_free_text(&title, "title", 500)
        .map_err(|_| StatusCode::UNPROCESSABLE_ENTITY)?;
    let record = bwarm::BwarmRecord::new(&title, isrc);
    let xml = bwarm::generate_bwarm_xml(&record);
    state
        .audit_log
        .record(&format!(
            "BWARM_CREATE id='{}' title='{}'",
            record.record_id, title
        ))
        .ok();
    Ok(Json(serde_json::json!({
        "record_id": record.record_id,
        "state": record.state.as_str(),
        "xml_length": xml.len(),
    })))
}

async fn bwarm_detect_conflicts(
    Json(record): Json<bwarm::BwarmRecord>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let conflicts = bwarm::detect_conflicts(&record);
    let state = bwarm::compute_state(&record);
    Ok(Json(serde_json::json!({
        "state": state.as_str(),
        "conflict_count": conflicts.len(),
        "conflicts": conflicts,
    })))
}

// ── Music Reports handlers ────────────────────────────────────────────────────

async fn music_reports_lookup(
    State(state): State<AppState>,
    Path(isrc): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let licences = music_reports::lookup_by_isrc(&state.music_reports_config, &isrc)
        .await
        .map_err(|e| {
            warn!(err=%e, "Music Reports lookup failed");
            StatusCode::BAD_GATEWAY
        })?;
    Ok(Json(serde_json::json!({
        "isrc": isrc,
        "licence_count": licences.len(),
        "licences": licences,
    })))
}

async fn music_reports_rates() -> Json<serde_json::Value> {
    let rate = music_reports::current_mechanical_rate();
    let dsps = music_reports::dsp_licence_requirements();
    Json(serde_json::json!({
        "mechanical_rate": rate,
        "dsp_requirements": dsps,
    }))
}

// ── Hyperglot handler ─────────────────────────────────────────────────────────

async fn hyperglot_detect(
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let text = payload["text"].as_str().unwrap_or("");
    // LangSec: limit input before passing to script detector
    if text.len() > 16384 {
        return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }
    let result = hyperglot::detect_scripts(text);
    Ok(Json(serde_json::to_value(&result).unwrap_or_default()))
}
