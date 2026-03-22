// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @title SoulboundNFT
/// @notice ERC-5192 (Minimal Soulbound Token) for track registrations.
///
/// One token is minted per track (keyed by ISRC). Each token permanently
/// records the creative attribution — who wrote and published the work,
/// their IPI numbers, and their royalty split basis-points — at the time
/// the work was registered and all parties had their KYC verified.
///
/// ERC-5192 compliance: tokens are locked at mint; transfer and approval
/// operations are disabled.  The token is burned only by the admin in
/// response to a successful DMCA takedown.
///
/// The token ID is derived deterministically:
///   tokenId = uint256(keccak256(bytes(isrc)))
/// so any party can compute the token ID for a known ISRC off-chain.
///
/// SECURITY:
///   - Only the platform contract (`minter`) may mint or burn tokens.
///   - Contributor records are immutable once minted — no update path.
///   - All on-chain data (addresses, IPI) was KYC-verified off-chain
///     before minting; the minter contract enforces this gate.
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

contract SoulboundNFT is IERC5192 {

    // ── Types ──────────────────────────────────────────────────────────────
    struct Contributor {
        address wallet;
        string  ipiNumber;   // 9-11 digit IPI name number
        string  role;        // "Songwriter", "Composer", "Publisher", "Admin Publisher"
        uint16  bps;         // Royalty share in basis points (Σ = 10,000)
    }

    struct TrackToken {
        uint256   tokenId;
        string    isrc;      // International Standard Recording Code
        string    btfsCid;   // BTFS content identifier (audio + metadata)
        uint8     band;      // Master Pattern band (0=Common, 1=Rare, 2=Legendary)
        uint256   mintedAt;
        bool      burned;
        Contributor[] contributors;
    }

    // ── State ──────────────────────────────────────────────────────────────
    address public immutable admin;
    address public           minter;  // PublishingAgreement contract

    mapping(uint256 => TrackToken)    private _tokens;
    mapping(uint256 => address)       private _ownerOf;
    mapping(string  => uint256)       public  isrcToTokenId;

    uint256 public totalMinted;
    uint256 public totalBurned;

    // ── Events ─────────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event TrackMinted(
        uint256 indexed tokenId,
        string  isrc,
        string  btfsCid,
        uint8   band,
        uint256 contributorCount
    );
    event TrackBurned(uint256 indexed tokenId, string isrc, address indexed by);
    event MinterSet(address indexed minter);

    // ── Access control ────────────────────────────────────────────────────
    modifier onlyAdmin()  { require(msg.sender == admin,  "SBT: not admin");  _; }
    modifier onlyMinter() { require(msg.sender == minter, "SBT: not minter"); _; }

    constructor() {
        admin = msg.sender;
    }

    /// @notice Set the minter address (PublishingAgreement contract).
    /// Can only be called once — immutable thereafter.
    function setMinter(address _minter) external onlyAdmin {
        require(minter == address(0),  "SBT: minter already set");
        require(_minter != address(0), "SBT: zero minter");
        minter = _minter;
        emit MinterSet(_minter);
    }

    // ── Core: mint ────────────────────────────────────────────────────────

    /// @notice Mint a soulbound token for a registered track.
    /// Called by PublishingAgreement once all parties have signed.
    /// @param isrc         ISRC code (e.g. "US-ABC-24-00001")
    /// @param btfsCid      BTFS content identifier
    /// @param band         Master Pattern band
    /// @param contributors Ordered list of contributors (addresses + IPI + roles + bps)
    /// @return tokenId     Deterministic token ID = uint256(keccak256(bytes(isrc)))
    function mint(
        string calldata isrc,
        string calldata btfsCid,
        uint8  band,
        Contributor[] calldata contributors
    ) external onlyMinter returns (uint256 tokenId) {
        require(bytes(isrc).length > 0,   "SBT: empty ISRC");
        require(bytes(btfsCid).length > 0, "SBT: empty CID");
        require(band <= 2,                 "SBT: invalid band");
        require(contributors.length > 0,   "SBT: no contributors");
        require(contributors.length <= 16, "SBT: too many contributors");

        // Validate bps sum
        uint256 bpsSum;
        for (uint i = 0; i < contributors.length; i++) {
            require(contributors[i].wallet != address(0), "SBT: zero contributor wallet");
            require(bytes(contributors[i].ipiNumber).length >= 9, "SBT: IPI too short");
            bpsSum += contributors[i].bps;
        }
        require(bpsSum == 10_000, "SBT: bps must sum to 10000");

        tokenId = uint256(keccak256(bytes(isrc)));
        require(_ownerOf[tokenId] == address(0), "SBT: already minted for this ISRC");

        // Mint to the first contributor (primary songwriter) as nominal owner.
        // Ownership is symbolic — the token cannot be transferred.
        address primaryOwner = contributors[0].wallet;
        _ownerOf[tokenId] = primaryOwner;
        isrcToTokenId[isrc] = tokenId;
        totalMinted++;

        // Store token data
        TrackToken storage t = _tokens[tokenId];
        t.tokenId   = tokenId;
        t.isrc      = isrc;
        t.btfsCid   = btfsCid;
        t.band      = band;
        t.mintedAt  = block.timestamp;
        t.burned    = false;
        for (uint i = 0; i < contributors.length; i++) {
            t.contributors.push(contributors[i]);
        }

        emit Transfer(address(0), primaryOwner, tokenId);
        emit Locked(tokenId);
        emit TrackMinted(tokenId, isrc, btfsCid, band, contributors.length);
    }

    // ── Core: burn (DMCA takedown) ─────────────────────────────────────────

    /// @notice Burn a soulbound token following a verified DMCA takedown.
    /// Admin-only. Records the burn permanently on-chain.
    function burn(uint256 tokenId) external onlyAdmin {
        address owner = _ownerOf[tokenId];
        require(owner != address(0),        "SBT: token does not exist");
        require(!_tokens[tokenId].burned,   "SBT: already burned");
        _tokens[tokenId].burned = true;
        totalBurned++;
        emit TrackBurned(tokenId, _tokens[tokenId].isrc, msg.sender);
        emit Transfer(owner, address(0), tokenId);
    }

    // ── ERC-5192: always locked ────────────────────────────────────────────

    function locked(uint256 tokenId) external view override returns (bool) {
        require(_ownerOf[tokenId] != address(0), "SBT: nonexistent token");
        return true; // Soulbound — permanently locked
    }

    // ── ERC-721-compatible view functions (read-only subset) ──────────────

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _ownerOf[tokenId];
        require(owner != address(0), "SBT: nonexistent token");
        return owner;
    }

    function tokenExists(uint256 tokenId) external view returns (bool) {
        return _ownerOf[tokenId] != address(0) && !_tokens[tokenId].burned;
    }

    function getToken(uint256 tokenId) external view returns (
        string memory isrc,
        string memory btfsCid,
        uint8  band,
        uint256 mintedAt,
        bool   burned,
        uint256 contributorCount
    ) {
        TrackToken storage t = _tokens[tokenId];
        require(bytes(t.isrc).length > 0, "SBT: nonexistent token");
        return (t.isrc, t.btfsCid, t.band, t.mintedAt, t.burned, t.contributors.length);
    }

    function getContributor(uint256 tokenId, uint256 index) external view returns (
        address wallet,
        string  memory ipiNumber,
        string  memory role,
        uint16  bps
    ) {
        TrackToken storage t = _tokens[tokenId];
        require(index < t.contributors.length, "SBT: contributor index out of range");
        Contributor storage c = t.contributors[index];
        return (c.wallet, c.ipiNumber, c.role, c.bps);
    }

    // ── Disabled: transfers and approvals ─────────────────────────────────

    /// @dev All transfer and approval operations are disabled — tokens are soulbound.
    function transferFrom(address, address, uint256) external pure {
        revert("SoulboundNFT: token is non-transferable");
    }
    function safeTransferFrom(address, address, uint256) external pure {
        revert("SoulboundNFT: token is non-transferable");
    }
    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert("SoulboundNFT: token is non-transferable");
    }
    function approve(address, uint256) external pure {
        revert("SoulboundNFT: token is non-transferable");
    }
    function setApprovalForAll(address, bool) external pure {
        revert("SoulboundNFT: token is non-transferable");
    }

    // ── ERC-165 ───────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC-165
            interfaceId == 0x80ac58cd || // ERC-721 (partial: read-only)
            interfaceId == 0xb45a3c0e;   // ERC-5192
    }
}
