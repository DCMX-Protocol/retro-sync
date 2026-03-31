// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SoulboundNFT.sol";

contract SoulboundNFTTest is Test {
    SoulboundNFT nft;
    address admin   = address(this);
    address minter  = makeAddr("minter");
    address writer  = makeAddr("writer");
    address publisher = makeAddr("publisher");

    function setUp() public {
        nft = new SoulboundNFT();
        nft.setMinter(minter);
    }

    // ── helpers ──────────────────────────────────────────────────────────
    function _makeContributors() internal view returns (SoulboundNFT.Contributor[] memory) {
        SoulboundNFT.Contributor[] memory c = new SoulboundNFT.Contributor[](2);
        c[0] = SoulboundNFT.Contributor({ wallet: writer,    ipiNumber: "00523879412", role: "Songwriter", bps: 6000 });
        c[1] = SoulboundNFT.Contributor({ wallet: publisher, ipiNumber: "00612345678", role: "Publisher",  bps: 4000 });
        return c;
    }

    // ── setMinter ─────────────────────────────────────────────────────────
    function test_setMinterOnce() public {
        SoulboundNFT n = new SoulboundNFT();
        n.setMinter(minter);
        vm.expectRevert("SBT: minter already set");
        n.setMinter(minter);
    }

    function test_setMinterZeroReverts() public {
        SoulboundNFT n = new SoulboundNFT();
        vm.expectRevert("SBT: zero minter");
        n.setMinter(address(0));
    }

    function test_setMinterNotAdmin() public {
        SoulboundNFT n = new SoulboundNFT();
        vm.prank(writer);
        vm.expectRevert("SBT: not admin");
        n.setMinter(minter);
    }

    // ── mint ──────────────────────────────────────────────────────────────
    function test_mintHappyPath() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        uint256 id = nft.mint("US-ABC-24-00001", "QmTestCid", 1, c);

        assertEq(id, uint256(keccak256(bytes("US-ABC-24-00001"))));
        assertEq(nft.ownerOf(id), writer);
        assertTrue(nft.locked(id));
        assertTrue(nft.tokenExists(id));
        assertEq(nft.totalMinted(), 1);
        assertEq(nft.isrcToTokenId("US-ABC-24-00001"), id);
    }

    function test_mintOnlyMinter() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(writer);
        vm.expectRevert("SBT: not minter");
        nft.mint("US-ABC-24-00002", "QmCid2", 0, c);
    }

    function test_mintDuplicateISRCReverts() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        nft.mint("US-ABC-24-00001", "QmTestCid", 1, c);
        vm.prank(minter);
        vm.expectRevert("SBT: already minted for this ISRC");
        nft.mint("US-ABC-24-00001", "QmTestCid2", 1, c);
    }

    function test_mintBpsMustSum10000() public {
        SoulboundNFT.Contributor[] memory c = new SoulboundNFT.Contributor[](1);
        c[0] = SoulboundNFT.Contributor({ wallet: writer, ipiNumber: "00523879412", role: "Songwriter", bps: 5000 });
        vm.prank(minter);
        vm.expectRevert("SBT: bps must sum to 10000");
        nft.mint("US-ABC-24-00003", "QmCid3", 0, c);
    }

    function test_mintEmptyISRCReverts() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        vm.expectRevert("SBT: empty ISRC");
        nft.mint("", "QmCid", 0, c);
    }

    function test_mintInvalidBandReverts() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        vm.expectRevert("SBT: invalid band");
        nft.mint("US-ABC-24-00009", "QmCid", 3, c);
    }

    function test_mintZeroContributorWalletReverts() public {
        SoulboundNFT.Contributor[] memory c = new SoulboundNFT.Contributor[](2);
        c[0] = SoulboundNFT.Contributor({ wallet: address(0), ipiNumber: "00523879412", role: "Songwriter", bps: 6000 });
        c[1] = SoulboundNFT.Contributor({ wallet: publisher,  ipiNumber: "00612345678", role: "Publisher",  bps: 4000 });
        vm.prank(minter);
        vm.expectRevert("SBT: zero contributor wallet");
        nft.mint("US-ABC-24-00010", "QmCid", 0, c);
    }

    // ── getContributor ────────────────────────────────────────────────────
    function test_getContributorData() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        uint256 id = nft.mint("US-ABC-24-00004", "QmTestCid4", 2, c);

        (address w, string memory ipi, string memory role, uint16 bps) = nft.getContributor(id, 0);
        assertEq(w, writer);
        assertEq(ipi, "00523879412");
        assertEq(role, "Songwriter");
        assertEq(bps, 6000);
    }

    // ── transfer disabled ─────────────────────────────────────────────────
    function test_transferDisabled() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        uint256 id = nft.mint("US-ABC-24-00005", "QmCid5", 0, c);

        vm.prank(writer);
        vm.expectRevert("SoulboundNFT: token is non-transferable");
        nft.transferFrom(writer, publisher, id);
    }

    function test_approveDisabled() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        nft.mint("US-ABC-24-00006", "QmCid6", 1, c);

        vm.prank(writer);
        vm.expectRevert("SoulboundNFT: token is non-transferable");
        nft.approve(publisher, uint256(keccak256(bytes("US-ABC-24-00006"))));
    }

    // ── burn ──────────────────────────────────────────────────────────────
    function test_burnByAdmin() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        uint256 id = nft.mint("US-ABC-24-00007", "QmCid7", 0, c);

        nft.burn(id);
        assertFalse(nft.tokenExists(id));
        assertEq(nft.totalBurned(), 1);
    }

    function test_burnNotAdmin() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        uint256 id = nft.mint("US-ABC-24-00008", "QmCid8", 1, c);

        vm.prank(writer);
        vm.expectRevert("SBT: not admin");
        nft.burn(id);
    }

    function test_burnDoubleBurnReverts() public {
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        vm.prank(minter);
        uint256 id = nft.mint("US-ABC-24-00011", "QmCid11", 0, c);
        nft.burn(id);
        vm.expectRevert("SBT: already burned");
        nft.burn(id);
    }

    // ── fuzz ──────────────────────────────────────────────────────────────
    /// @dev Band must be 0, 1, or 2.
    function testFuzz_mintBand(uint8 band) public {
        vm.assume(band <= 2);
        SoulboundNFT.Contributor[] memory c = _makeContributors();
        // Use band as part of ISRC to avoid collision
        string memory isrc = string(abi.encodePacked("US-FZ-24-", vm.toString(uint256(band)), "0001"));
        vm.prank(minter);
        uint256 id = nft.mint(isrc, "QmFuzz", band, c);
        (,, uint8 gotBand,,,) = nft.getToken(id);
        assertEq(gotBand, band);
    }
}
