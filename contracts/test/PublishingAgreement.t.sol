// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SoulboundNFT.sol";
import "../src/PublishingAgreement.sol";

contract PublishingAgreementTest is Test {
    SoulboundNFT       nft;
    PublishingAgreement pa;

    address admin     = address(this);
    address writer    = makeAddr("writer");
    address cowriter  = makeAddr("cowriter");
    address publisher = makeAddr("publisher");

    function setUp() public {
        nft = new SoulboundNFT();
        pa  = new PublishingAgreement(address(nft));
        nft.setMinter(address(pa));
    }

    // ── helpers ──────────────────────────────────────────────────────────
    function _propose(string memory isrc) internal returns (bytes32 id) {
        address[]  memory wallets = new address[](3);
        string[]   memory ipis    = new string[](3);
        string[]   memory roles   = new string[](3);
        uint16[]   memory bps     = new uint16[](3);

        wallets[0] = writer;    ipis[0] = "00523879412"; roles[0] = "Songwriter";  bps[0] = 5000;
        wallets[1] = cowriter;  ipis[1] = "00534567890"; roles[1] = "Songwriter";  bps[1] = 3000;
        wallets[2] = publisher; ipis[2] = "00612345678"; roles[2] = "Publisher";   bps[2] = 2000;

        id = pa.propose(isrc, "QmTestCid", 1, wallets, ipis, roles, bps);
    }

    // ── propose ───────────────────────────────────────────────────────────
    function test_proposeHappyPath() public {
        bytes32 id = _propose("US-ABC-24-00001");
        (,,,, PublishingAgreement.AgreementStatus status,,uint256 partyCount,) = pa.getAgreement(id);
        assertEq(uint8(status), uint8(PublishingAgreement.AgreementStatus.Proposed));
        assertEq(partyCount, 3);
    }

    function test_proposeNotAdmin() public {
        address[] memory w = new address[](1);
        string[]  memory i = new string[](1);
        string[]  memory r = new string[](1);
        uint16[]  memory b = new uint16[](1);
        w[0] = writer; i[0] = "00523879412"; r[0] = "Songwriter"; b[0] = 10000;
        vm.prank(writer);
        vm.expectRevert("PA: not admin");
        pa.propose("US-ABC-24-00002", "QmCid", 0, w, i, r, b);
    }

    function test_proposeDuplicateISRCReverts() public {
        _propose("US-ABC-24-00001");
        vm.expectRevert("PA: ISRC already has agreement");
        _propose("US-ABC-24-00001");
    }

    function test_proposeBpsMismatchReverts() public {
        address[] memory w = new address[](1);
        string[]  memory i = new string[](1);
        string[]  memory r = new string[](1);
        uint16[]  memory b = new uint16[](1);
        w[0] = writer; i[0] = "00523879412"; r[0] = "Songwriter"; b[0] = 9999;
        vm.expectRevert("PA: bps must sum to 10000");
        pa.propose("US-ABC-24-00003", "QmCid", 0, w, i, r, b);
    }

    function test_proposeArrayLengthMismatchReverts() public {
        address[] memory w = new address[](2);
        string[]  memory i = new string[](1);
        string[]  memory r = new string[](2);
        uint16[]  memory b = new uint16[](2);
        vm.expectRevert("PA: array length mismatch");
        pa.propose("US-ABC-24-00004", "QmCid", 0, w, i, r, b);
    }

    // ── sign ──────────────────────────────────────────────────────────────
    function test_signPartial() public {
        bytes32 id = _propose("US-ABC-24-00010");

        vm.prank(writer);
        pa.sign(id);

        assertTrue(pa.hasPartySignedAgreement(id, writer));
        (,,,, PublishingAgreement.AgreementStatus status,,,) = pa.getAgreement(id);
        assertEq(uint8(status), uint8(PublishingAgreement.AgreementStatus.PartialSigned));
    }

    function test_signAllMintsNFT() public {
        bytes32 id = _propose("US-ABC-24-00020");

        vm.prank(writer);    pa.sign(id);
        vm.prank(cowriter);  pa.sign(id);
        vm.prank(publisher); pa.sign(id);

        (,,,, PublishingAgreement.AgreementStatus status, uint256 tokenId,,) = pa.getAgreement(id);
        assertEq(uint8(status), uint8(PublishingAgreement.AgreementStatus.AllSigned));
        assertGt(tokenId, 0);
        assertTrue(nft.tokenExists(tokenId));
    }

    function test_signNonPartyReverts() public {
        bytes32 id = _propose("US-ABC-24-00030");
        vm.prank(makeAddr("stranger"));
        vm.expectRevert("PA: caller is not a party to this agreement");
        pa.sign(id);
    }

    function test_signDoubleReverts() public {
        bytes32 id = _propose("US-ABC-24-00040");
        vm.prank(writer);
        pa.sign(id);
        vm.prank(writer);
        vm.expectRevert("PA: already signed");
        pa.sign(id);
    }

    function test_signFullySignedReverts() public {
        // Single-party agreement
        address[] memory w = new address[](1);
        string[]  memory i = new string[](1);
        string[]  memory r = new string[](1);
        uint16[]  memory b = new uint16[](1);
        w[0] = writer; i[0] = "00523879412"; r[0] = "Songwriter"; b[0] = 10000;
        bytes32 id = pa.propose("US-ABC-24-00050", "QmCid", 0, w, i, r, b);

        vm.prank(writer);
        pa.sign(id);

        vm.prank(writer);
        vm.expectRevert("PA: already fully signed");
        pa.sign(id);
    }

    // ── cancel ────────────────────────────────────────────────────────────
    function test_cancelByAdmin() public {
        bytes32 id = _propose("US-ABC-24-00060");
        pa.cancel(id);
        (,,,, PublishingAgreement.AgreementStatus status,,,) = pa.getAgreement(id);
        assertEq(uint8(status), uint8(PublishingAgreement.AgreementStatus.Canceled));
    }

    function test_cancelAfterFinalizationReverts() public {
        address[] memory w = new address[](1);
        string[]  memory i = new string[](1);
        string[]  memory r = new string[](1);
        uint16[]  memory b = new uint16[](1);
        w[0] = writer; i[0] = "00523879412"; r[0] = "Songwriter"; b[0] = 10000;
        bytes32 id = pa.propose("US-ABC-24-00070", "QmCid", 0, w, i, r, b);

        vm.prank(writer);
        pa.sign(id);

        vm.expectRevert("PA: already finalized");
        pa.cancel(id);
    }

    function test_cancelNotAdminReverts() public {
        bytes32 id = _propose("US-ABC-24-00080");
        vm.prank(writer);
        vm.expectRevert("PA: not admin");
        pa.cancel(id);
    }

    // ── sign after cancel ─────────────────────────────────────────────────
    function test_signCanceledReverts() public {
        bytes32 id = _propose("US-ABC-24-00090");
        pa.cancel(id);
        vm.prank(writer);
        vm.expectRevert("PA: agreement canceled");
        pa.sign(id);
    }

    // ── fuzz ──────────────────────────────────────────────────────────────
    /// @dev Any address that is NOT a party should be rejected when signing.
    function testFuzz_signNonPartyReverts(address stranger) public {
        vm.assume(stranger != writer && stranger != cowriter && stranger != publisher);
        bytes32 id = _propose("US-ABC-24-FUZZ1");
        vm.prank(stranger);
        vm.expectRevert("PA: caller is not a party to this agreement");
        pa.sign(id);
    }
}
