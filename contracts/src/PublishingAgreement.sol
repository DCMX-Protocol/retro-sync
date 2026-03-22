// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import "./SoulboundNFT.sol";

/// @title PublishingAgreement
/// @notice On-chain publishing agreement between songwriters and publishers.
///
/// Life-cycle:
///   1. Admin proposes an agreement for a track (POST /api/register).
///      This records the ISRC, BTFS CID, band, and all contributor parties.
///   2. Each contributor calls sign(agreementId) from their wallet.
///   3. Once every contributor has signed, the contract calls
///      SoulboundNFT.mint(), permanently recording the creative attribution.
///   4. The emitted AgreementFullySigned + SoulboundMinted events signal
///      the backend to proceed with DDEX delivery.
///
/// SECURITY:
///   - Only the platform admin may propose and cancel agreements.
///   - Each contributor may only sign their own agreement.
///   - bps must sum to exactly 10,000 at proposal time.
///   - The contract is non-upgradeable.  Any amendment requires a new
///     agreement with a different ISRC or a new version suffix.
contract PublishingAgreement {

    // ── Types ──────────────────────────────────────────────────────────────
    enum AgreementStatus {
        Proposed,         // Created by admin, awaiting signatures
        PartialSigned,    // Some contributors have signed
        AllSigned,        // All contributors signed — NFT minted
        Canceled          // Admin canceled before all signatures
    }

    struct Party {
        address wallet;
        string  ipiNumber;
        string  role;
        uint16  bps;
        bool    signed;
        uint256 signedAt;
    }

    struct Agreement {
        bytes32         id;          // keccak256(abi.encode(isrc, proposedAt))
        string          isrc;
        string          btfsCid;
        uint8           band;
        uint256         proposedAt;
        AgreementStatus status;
        uint256         soulboundTokenId;
        Party[]         parties;
        uint256         signedCount;
    }

    // ── State ──────────────────────────────────────────────────────────────
    address public immutable admin;
    SoulboundNFT public immutable nft;

    mapping(bytes32 => Agreement)             private _agreements;
    mapping(string  => bytes32)               public  isrcToAgreement;
    mapping(bytes32 => mapping(address => uint256)) private _partyIndex; // 1-indexed

    bytes32[] public agreementIds;

    // ── Events ─────────────────────────────────────────────────────────────
    event AgreementProposed(
        bytes32 indexed agreementId,
        string  isrc,
        string  btfsCid,
        uint256 partyCount
    );
    event PartySignedAgreement(
        bytes32 indexed agreementId,
        address indexed signer,
        string  ipiNumber,
        uint256 signaturesRemaining
    );
    event AgreementFullySigned(bytes32 indexed agreementId, string isrc);
    event SoulboundMinted(
        bytes32 indexed agreementId,
        string  isrc,
        uint256 indexed tokenId
    );
    event AgreementCanceled(bytes32 indexed agreementId, string isrc);

    // ── Access control ────────────────────────────────────────────────────
    modifier onlyAdmin() { require(msg.sender == admin, "PA: not admin"); _; }

    constructor(address _nft) {
        require(_nft != address(0), "PA: zero NFT");
        admin = msg.sender;
        nft   = SoulboundNFT(_nft);
    }

    // ── Core: propose ─────────────────────────────────────────────────────

    /// @notice Propose a new publishing agreement.
    /// Called by the platform backend once KYC has been verified for all parties.
    ///
    /// @param isrc      ISRC code for the track
    /// @param btfsCid   BTFS CID of the audio file
    /// @param band      Master Pattern band
    /// @param wallets   Party wallet addresses (parallel arrays)
    /// @param ipiNums   IPI numbers (parallel arrays)
    /// @param roles     Party roles e.g. "Songwriter", "Publisher"
    /// @param bpsSplits Royalty splits in basis-points (must sum to 10,000)
    /// @return agreementId The unique agreement identifier
    function propose(
        string   calldata isrc,
        string   calldata btfsCid,
        uint8    band,
        address[] calldata wallets,
        string[]  calldata ipiNums,
        string[]  calldata roles,
        uint16[]  calldata bpsSplits
    ) external onlyAdmin returns (bytes32 agreementId) {
        require(bytes(isrc).length > 0,   "PA: empty ISRC");
        require(bytes(btfsCid).length > 0, "PA: empty CID");
        require(wallets.length > 0,        "PA: no parties");
        require(wallets.length <= 16,      "PA: too many parties");
        require(
            wallets.length == ipiNums.length &&
            wallets.length == roles.length   &&
            wallets.length == bpsSplits.length,
            "PA: array length mismatch"
        );
        require(isrcToAgreement[isrc] == bytes32(0), "PA: ISRC already has agreement");

        uint256 bpsSum;
        for (uint i = 0; i < bpsSplits.length; i++) {
            require(wallets[i] != address(0),        "PA: zero wallet");
            require(bytes(ipiNums[i]).length >= 9,   "PA: IPI too short");
            bpsSum += bpsSplits[i];
        }
        require(bpsSum == 10_000, "PA: bps must sum to 10000");

        agreementId = keccak256(abi.encode(isrc, block.timestamp, block.number));
        require(_agreements[agreementId].proposedAt == 0, "PA: id collision");

        Agreement storage a = _agreements[agreementId];
        a.id         = agreementId;
        a.isrc       = isrc;
        a.btfsCid    = btfsCid;
        a.band       = band;
        a.proposedAt = block.timestamp;
        a.status     = AgreementStatus.Proposed;

        for (uint i = 0; i < wallets.length; i++) {
            a.parties.push(Party({
                wallet:   wallets[i],
                ipiNumber: ipiNums[i],
                role:     roles[i],
                bps:      bpsSplits[i],
                signed:   false,
                signedAt: 0
            }));
            _partyIndex[agreementId][wallets[i]] = i + 1; // 1-indexed
        }

        isrcToAgreement[isrc] = agreementId;
        agreementIds.push(agreementId);

        emit AgreementProposed(agreementId, isrc, btfsCid, wallets.length);
    }

    // ── Core: sign ─────────────────────────────────────────────────────────

    /// @notice Sign a publishing agreement from a contributor's wallet.
    /// Once all parties have signed, the soulbound NFT is minted automatically.
    function sign(bytes32 agreementId) external {
        Agreement storage a = _agreements[agreementId];
        require(a.proposedAt != 0,                         "PA: agreement not found");
        require(a.status != AgreementStatus.Canceled,      "PA: agreement canceled");
        require(a.status != AgreementStatus.AllSigned,     "PA: already fully signed");

        uint256 idx = _partyIndex[agreementId][msg.sender];
        require(idx != 0, "PA: caller is not a party to this agreement");

        Party storage party = a.parties[idx - 1];
        require(!party.signed, "PA: already signed");

        party.signed   = true;
        party.signedAt = block.timestamp;
        a.signedCount++;

        uint256 remaining = a.parties.length - a.signedCount;
        emit PartySignedAgreement(agreementId, msg.sender, party.ipiNumber, remaining);

        if (remaining == 0) {
            a.status = AgreementStatus.AllSigned;
            emit AgreementFullySigned(agreementId, a.isrc);
            _mintSoulbound(agreementId);
        } else {
            a.status = AgreementStatus.PartialSigned;
        }
    }

    /// @dev Internal: build contributor array for SoulboundNFT and mint.
    function _mintSoulbound(bytes32 agreementId) internal {
        Agreement storage a = _agreements[agreementId];
        uint256 n = a.parties.length;
        SoulboundNFT.Contributor[] memory contrib = new SoulboundNFT.Contributor[](n);
        for (uint i = 0; i < n; i++) {
            contrib[i] = SoulboundNFT.Contributor({
                wallet:    a.parties[i].wallet,
                ipiNumber: a.parties[i].ipiNumber,
                role:      a.parties[i].role,
                bps:       a.parties[i].bps
            });
        }
        uint256 tokenId = nft.mint(a.isrc, a.btfsCid, a.band, contrib);
        a.soulboundTokenId = tokenId;
        emit SoulboundMinted(agreementId, a.isrc, tokenId);
    }

    // ── Core: cancel ──────────────────────────────────────────────────────

    /// @notice Cancel a proposed agreement (admin only, before all signatures).
    function cancel(bytes32 agreementId) external onlyAdmin {
        Agreement storage a = _agreements[agreementId];
        require(a.proposedAt != 0,                     "PA: agreement not found");
        require(a.status != AgreementStatus.AllSigned,  "PA: already finalized");
        require(a.status != AgreementStatus.Canceled,   "PA: already canceled");
        a.status = AgreementStatus.Canceled;
        delete isrcToAgreement[a.isrc];
        emit AgreementCanceled(agreementId, a.isrc);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    function getAgreement(bytes32 agreementId) external view returns (
        string  memory isrc,
        string  memory btfsCid,
        uint8   band,
        uint256 proposedAt,
        AgreementStatus status,
        uint256 soulboundTokenId,
        uint256 partyCount,
        uint256 signedCount
    ) {
        Agreement storage a = _agreements[agreementId];
        require(a.proposedAt != 0, "PA: not found");
        return (
            a.isrc, a.btfsCid, a.band, a.proposedAt,
            a.status, a.soulboundTokenId, a.parties.length, a.signedCount
        );
    }

    function getParty(bytes32 agreementId, uint256 index) external view returns (
        address wallet,
        string  memory ipiNumber,
        string  memory role,
        uint16  bps,
        bool    signed_,
        uint256 signedAt
    ) {
        Agreement storage a = _agreements[agreementId];
        require(index < a.parties.length, "PA: index out of range");
        Party storage p = a.parties[index];
        return (p.wallet, p.ipiNumber, p.role, p.bps, p.signed, p.signedAt);
    }

    function hasPartySignedAgreement(bytes32 agreementId, address party) external view returns (bool) {
        uint256 idx = _partyIndex[agreementId][party];
        if (idx == 0) return false;
        return _agreements[agreementId].parties[idx - 1].signed;
    }

    function totalAgreements() external view returns (uint256) {
        return agreementIds.length;
    }
}
