import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music, Upload, CheckCircle2, AlertCircle, Terminal, Cpu,
  Plus, Trash2, UserPlus, FileAudio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useWallet } from "@/hooks/useWallet";

const ISRC_PATTERN = /^[A-Z]{2}-[A-Z0-9]{3}-\d{2}-\d{5}$/;
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const IPI_PATTERN = /^\d{9,11}$/;
const VALID_ROLES = ["Songwriter", "Composer", "Lyricist", "Publisher", "Admin Publisher"] as const;
type ContributorRole = typeof VALID_ROLES[number];

interface Contributor {
  id: string;
  address: string;
  ipiNumber: string;
  role: ContributorRole;
  bps: string;
}

interface UploadResult {
  cid: string;
  isrc: string;
  band: number;
  rarity: string;
  dsp_ready: boolean;
  registration_id?: string;
  soulbound_pending?: boolean;
  ddex_submitted?: boolean;
}

const makeId = () => Math.random().toString(36).slice(2, 9);

const emptyContributor = (): Contributor => ({
  id: makeId(),
  address: "",
  ipiNumber: "",
  role: "Songwriter",
  bps: "",
});

const MetadataUpload = () => {
  const { wallet, authHeaders } = useWallet();
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"form" | "uploading" | "registering" | "success">("form");
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [title, setTitle] = useState("");
  const [isrc, setIsrc] = useState("");
  const [contributors, setContributors] = useState<Contributor[]>([
    { ...emptyContributor(), address: wallet.address, role: "Songwriter" },
  ]);

  const bpsSum = contributors.reduce((sum, c) => sum + (parseInt(c.bps) || 0), 0);
  const bpsValid = bpsSum === 10000;

  const addContributor = () => {
    if (contributors.length < 16) {
      setContributors((prev) => [...prev, emptyContributor()]);
    }
  };

  const removeContributor = (id: string) => {
    setContributors((prev) => prev.filter((c) => c.id !== id));
  };

  const updateContributor = (id: string, field: keyof Contributor, value: string) => {
    setContributors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
    const key = `${id}_${field}`;
    if (validationErrors[key]) {
      setValidationErrors((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) errors.title = "Song title is required.";

    const isrcNorm = isrc.trim().toUpperCase();
    if (!isrcNorm) {
      errors.isrc = "ISRC code is required.";
    } else if (!ISRC_PATTERN.test(isrcNorm)) {
      errors.isrc = "Format: CC-XXX-YY-NNNNN  e.g. US-ABC-24-00001";
    }

    if (!audioFile) errors.audio = "Audio file is required.";

    if (contributors.length === 0) {
      errors.contributors = "At least one contributor is required.";
    }

    contributors.forEach((c) => {
      if (!EVM_ADDRESS_PATTERN.test(c.address)) {
        errors[`${c.id}_address`] = "Must be a valid 0x EVM wallet address (42 chars).";
      }
      if (!IPI_PATTERN.test(c.ipiNumber.replace(/\D/g, ""))) {
        errors[`${c.id}_ipiNumber`] = "IPI must be 9–11 digits.";
      }
      const bpsVal = parseInt(c.bps);
      if (isNaN(bpsVal) || bpsVal <= 0 || bpsVal > 10000) {
        errors[`${c.id}_bps`] = "Must be 1–10000.";
      }
    });

    if (!errors.contributors && !bpsValid) {
      errors.bpsSum = `Splits must total 10,000 bps (100%). Current: ${bpsSum.toLocaleString()}`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.connected || !validate()) return;

    setServerError(null);

    try {
      // ── Step 1: Upload audio to BTFS via /api/upload (multipart) ────────
      setStep("uploading");
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("artist", wallet.address);
      fd.append("isrc", isrc.trim().toUpperCase());
      fd.append("audio", audioFile!);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { ...authHeaders() },
        body: fd,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => "");
        throw new Error(`Audio upload failed (${uploadRes.status}): ${text || uploadRes.statusText}`);
      }

      const uploadData = await uploadRes.json();
      const { cid, band, rarity, dsp_ready } = uploadData;

      // ── Step 2: Register publishing agreement via /api/register (JSON) ──
      setStep("registering");
      const registerPayload = {
        title: title.trim(),
        isrc: isrc.trim().toUpperCase(),
        btfs_cid: cid,
        band: band ?? 0,
        contributors: contributors.map((c) => ({
          address: c.address.trim().toLowerCase(),
          ipi_number: c.ipiNumber.replace(/\D/g, ""),
          role: c.role,
          bps: parseInt(c.bps),
        })),
      };

      const regRes = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(registerPayload),
      });

      if (!regRes.ok) {
        const text = await regRes.text().catch(() => "");
        throw new Error(`Registration failed (${regRes.status}): ${text || regRes.statusText}`);
      }

      const regData = await regRes.json();

      setResult({
        cid,
        isrc: isrc.trim().toUpperCase(),
        band: band ?? 0,
        rarity: rarity ?? "Common",
        dsp_ready: dsp_ready ?? false,
        registration_id: regData.registration_id,
        soulbound_pending: regData.soulbound_pending ?? true,
        ddex_submitted: regData.ddex_submitted ?? false,
      });
      setStep("success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submission failed. Please try again.";
      setServerError(message);
      setStep("form");
    }
  };

  const reset = () => {
    setStep("form");
    setResult(null);
    setServerError(null);
    setAudioFile(null);
    setTitle("");
    setIsrc("");
    setContributors([{ ...emptyContributor(), address: wallet.address, role: "Songwriter" }]);
    setValidationErrors({});
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  if (!wallet.connected) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-zinc-800 bg-zinc-950">
        <div className="w-16 h-16 bg-primary/10 border border-primary/50 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-black italic uppercase mb-2 text-white tracking-tighter">Access Denied</h2>
        <p className="text-zinc-500 font-mono text-sm max-w-sm mb-8 leading-tight">
          &gt; Error: Wallet_Not_Connected<br />
          &gt; Action: Connect a valid TronLink or Coinbase wallet to access the upload portal.
        </p>
      </div>
    );
  }

  if (step === "success" && result) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center p-12 text-center border border-primary/50 bg-primary/5"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="w-16 h-16 bg-primary border border-primary flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-2xl font-black italic uppercase mb-2 text-white tracking-tighter">
          Transmission Successful
        </h2>
        <div className="text-left w-full max-w-md font-mono text-[11px] text-zinc-400 space-y-1 mb-8 bg-zinc-900/60 border border-zinc-800 p-4">
          <div>&gt; ISRC: <span className="text-primary">{result.isrc}</span></div>
          <div>&gt; BTFS CID: <span className="text-primary break-all">{result.cid}</span></div>
          <div>&gt; Band: <span className="text-primary">{result.band}</span> ({result.rarity})</div>
          {result.registration_id && (
            <div>&gt; Reg ID: <span className="text-primary">{result.registration_id}</span></div>
          )}
          <div>&gt; DSP Ready: <span className={result.dsp_ready ? "text-green-400" : "text-yellow-400"}>{result.dsp_ready ? "YES" : "PENDING"}</span></div>
          <div>&gt; DDEX Submitted: <span className={result.ddex_submitted ? "text-green-400" : "text-yellow-400"}>{result.ddex_submitted ? "YES" : "PENDING"}</span></div>
          {result.soulbound_pending && (
            <div className="pt-2 border-t border-zinc-800 text-yellow-400">
              &gt; Soulbound NFT: PENDING — all contributors must sign<br />
              &nbsp;&nbsp;the on-chain publishing agreement from their wallets.
            </div>
          )}
        </div>
        <button
          onClick={reset}
          className="px-8 py-3 bg-zinc-900 border border-zinc-800 text-[10px] font-black uppercase tracking-widest hover:border-primary transition-all"
        >
          [ New_Transmission ]
        </button>
      </motion.div>
    );
  }

  const isProcessing = step === "uploading" || step === "registering";

  return (
    <div className="max-w-3xl mx-auto py-8 font-mono">
      <Card className="bg-zinc-950 border border-zinc-800 rounded-none overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Cpu className="w-20 h-20 text-primary" />
        </div>

        <div className="p-8 border-b border-zinc-800 bg-zinc-900/30 flex items-center gap-4">
          <div className="p-3 bg-primary/10 border border-primary/50">
            <Music className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Upload Protocol</h2>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
              BTFS_Upload → Publishing_Agreement → Soulbound_NFT → DDEX
            </div>
          </div>
        </div>

        <CardContent className="p-8 space-y-8">
          <div className="p-4 bg-primary/5 border border-primary/20 flex items-start gap-3">
            <Terminal className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <p className="text-[11px] text-zinc-400 leading-tight">
              <span className="text-primary font-bold">PROTOCOL:</span> Audio is uploaded to BTFS.
              A publishing agreement is created on-chain linking all contributors via their IPI-verified wallets.
              Once all parties sign, a <span className="text-primary">soulbound NFT</span> is minted and the
              track is delivered to Spotify, Apple Music, and other DSPs via DDEX ERN 4.1.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* ── Core metadata ── */}
            <div className="space-y-5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 border-b border-zinc-800 pb-2">
                _track_metadata
              </div>

              <div className="space-y-2">
                <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  _song_title *
                </Label>
                <Input
                  id="title"
                  placeholder="Enter title"
                  className="bg-black border-zinc-800 rounded-none focus:border-primary transition-colors text-sm"
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); if (validationErrors.title) setValidationErrors(p => ({ ...p, title: "" })); }}
                  disabled={isProcessing}
                />
                {validationErrors.title && <p className="text-[10px] text-destructive">{validationErrors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="isrc" className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  _isrc_code *
                </Label>
                <Input
                  id="isrc"
                  placeholder="US-ABC-24-00001"
                  className="bg-black border-zinc-800 rounded-none focus:border-primary transition-colors text-sm font-mono"
                  value={isrc}
                  onChange={(e) => { setIsrc(e.target.value); if (validationErrors.isrc) setValidationErrors(p => ({ ...p, isrc: "" })); }}
                  disabled={isProcessing}
                />
                <p className="text-[10px] text-zinc-600">Format: CC-XXX-YY-NNNNN</p>
                {validationErrors.isrc && <p className="text-[10px] text-destructive">{validationErrors.isrc}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  _audio_file *
                </Label>
                <div
                  className="border border-dashed border-zinc-700 hover:border-primary transition-colors p-6 cursor-pointer text-center"
                  onClick={() => audioInputRef.current?.click()}
                >
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setAudioFile(f);
                      if (validationErrors.audio) setValidationErrors(p => ({ ...p, audio: "" }));
                    }}
                    disabled={isProcessing}
                  />
                  {audioFile ? (
                    <div className="flex items-center justify-center gap-3 text-primary">
                      <FileAudio className="w-5 h-5" />
                      <span className="text-[11px] font-bold">{audioFile.name}</span>
                      <span className="text-zinc-500 text-[10px]">({(audioFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  ) : (
                    <div className="text-zinc-600 text-[11px]">
                      <Upload className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      Click to select audio file (max 100 MB)
                    </div>
                  )}
                </div>
                {validationErrors.audio && <p className="text-[10px] text-destructive">{validationErrors.audio}</p>}
              </div>
            </div>

            {/* ── Contributors ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  _contributors_&amp;_publishing_splits
                </div>
                <div className={`text-[10px] font-bold font-mono ${bpsValid ? "text-green-500" : bpsSum > 0 ? "text-yellow-500" : "text-zinc-600"}`}>
                  {bpsSum.toLocaleString()} / 10,000 bps
                </div>
              </div>

              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Add all songwriters, composers, and publishers. Splits must total exactly{" "}
                <strong className="text-zinc-300">10,000 basis points</strong> (100%). Each contributor
                must have a KYC-verified wallet linked to their IPI number before the soulbound NFT will mint.
              </p>

              <AnimatePresence>
                {contributors.map((c, idx) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border border-zinc-800 bg-zinc-900/30 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                        Party_{String(idx + 1).padStart(2, "0")}
                      </span>
                      {contributors.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeContributor(c.id)}
                          disabled={isProcessing}
                          className="p-1 hover:text-red-400 transition-colors text-zinc-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-zinc-600">Wallet Address *</label>
                        <Input
                          value={c.address}
                          onChange={(e) => updateContributor(c.id, "address", e.target.value)}
                          placeholder="0x..."
                          className="bg-black border-zinc-800 rounded-none focus:border-primary text-[11px] font-mono h-8"
                          disabled={isProcessing}
                        />
                        {validationErrors[`${c.id}_address`] && (
                          <p className="text-[9px] text-destructive">{validationErrors[`${c.id}_address`]}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-zinc-600">IPI Number *</label>
                        <Input
                          value={c.ipiNumber}
                          onChange={(e) => updateContributor(c.id, "ipiNumber", e.target.value.replace(/\D/g, "").slice(0, 11))}
                          placeholder="00523879412"
                          className="bg-black border-zinc-800 rounded-none focus:border-primary text-[11px] font-mono h-8"
                          disabled={isProcessing}
                          maxLength={11}
                        />
                        {validationErrors[`${c.id}_ipiNumber`] && (
                          <p className="text-[9px] text-destructive">{validationErrors[`${c.id}_ipiNumber`]}</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-zinc-600">Role *</label>
                        <select
                          value={c.role}
                          onChange={(e) => updateContributor(c.id, "role", e.target.value)}
                          disabled={isProcessing}
                          className="w-full h-8 bg-black border border-zinc-800 text-[11px] font-mono px-2 focus:outline-none focus:border-primary text-zinc-300"
                        >
                          {VALID_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-zinc-600">
                          Split (bps) * <span className="text-zinc-700 normal-case">/ 10,000 = 100%</span>
                        </label>
                        <Input
                          value={c.bps}
                          onChange={(e) => updateContributor(c.id, "bps", e.target.value.replace(/\D/g, "").slice(0, 5))}
                          placeholder="e.g. 5000 = 50%"
                          className="bg-black border-zinc-800 rounded-none focus:border-primary text-[11px] font-mono h-8"
                          disabled={isProcessing}
                        />
                        {validationErrors[`${c.id}_bps`] && (
                          <p className="text-[9px] text-destructive">{validationErrors[`${c.id}_bps`]}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {validationErrors.bpsSum && (
                <p className="text-[10px] text-destructive">{validationErrors.bpsSum}</p>
              )}
              {validationErrors.contributors && (
                <p className="text-[10px] text-destructive">{validationErrors.contributors}</p>
              )}

              {contributors.length < 16 && (
                <button
                  type="button"
                  onClick={addContributor}
                  disabled={isProcessing}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-primary transition-colors border border-dashed border-zinc-700 hover:border-primary px-4 py-2 w-full justify-center"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Contributor
                </button>
              )}
            </div>

            {/* ── Error / status ── */}
            {serverError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 text-[11px] text-destructive font-mono">
                &gt; Error: {serverError}
              </div>
            )}

            {/* ── Submit ── */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-6 p-3 bg-zinc-900/50 border-l-2 border-primary">
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">Signer_ID</span>
                <span className="text-[10px] font-mono text-primary font-bold truncate max-w-[200px]">
                  {wallet.address}
                </span>
              </div>

              {isProcessing && (
                <div className="mb-4 p-3 border border-zinc-800 text-[10px] font-mono text-zinc-400">
                  {step === "uploading" && "&gt; Step 1/2: Uploading audio to BTFS..."}
                  {step === "registering" && "&gt; Step 2/2: Registering publishing agreement + DDEX delivery..."}
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing || !bpsValid}
                className="w-full py-5 bg-primary text-primary-foreground font-black uppercase tracking-[0.2em] text-sm hover:bg-primary/90 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/20 border-t-primary-foreground rounded-full animate-spin" />
                    EXECUTING...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    [ START_TRANSMISSION ]
                  </>
                )}
              </button>

              {!bpsValid && contributors.length > 0 && bpsSum > 0 && (
                <p className="text-[10px] text-yellow-500 text-center mt-2">
                  Adjust splits so they total exactly 10,000 bps to enable submission.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default MetadataUpload;
