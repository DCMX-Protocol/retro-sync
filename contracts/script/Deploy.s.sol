// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockBTT.sol";
import "../src/ZKVerifier.sol";
import "../src/RoyaltyDistributor.sol";
import "../src/SoulboundNFT.sol";
import "../src/PublishingAgreement.sol";

/// @notice Deploys the full Retrosync contract suite to BTTC testnet.
///
/// Deployment order:
///   1. MockBTT              — ERC-20 test token (replace with real BTT on mainnet)
///   2. ZKVerifier           — Verifies ZK split proofs (VK set post-ceremony)
///   3. RoyaltyDistributor   — Distributes BTT royalties via ZK proofs
///   4. SoulboundNFT         — ERC-5192 soulbound track registry
///   5. PublishingAgreement  — Multi-party songwriter/publisher agreement contract;
///                             automatically mints SoulboundNFT once all parties sign
///
/// All signing is performed on the Ledger hardware device — no private key
/// ever touches the host machine.
///
/// Usage:
///   forge script script/Deploy.s.sol:DeployScript \
///     --rpc-url $BTTC_RPC_URL \
///     --ledger \
///     --hd-paths "m/44'/60'/0'/0/0" \
///     --legacy \
///     --broadcast \
///     --verify    // optional: source verify on BTTCScan
///
/// Dry-run (no broadcast, no hardware required):
///   forge script script/Deploy.s.sol:DeployScript --rpc-url $BTTC_RPC_URL --legacy
///
/// The HD path index can be overridden via env:
///   LEDGER_ACCOUNT=1 forge script ... --ledger --hd-paths "m/44'/60'/0'/0/1"
contract DeployScript is Script {
    function run() external {
        // msg.sender is set to the Ledger address when --ledger is passed.
        // vm.startBroadcast() with no argument uses the --sender / --ledger
        // address resolved by Forge — no private key is ever passed here.
        vm.startBroadcast();

        // 1. Deploy mock BTT (testnet only — replace with real BTT on mainnet)
        MockBTT btt = new MockBTT(1_000_000_000);
        console.log("MockBTT deployed:              ", address(btt));

        // 2. Deploy ZKVerifier — VK is set in a separate tx after ceremony
        ZKVerifier verifier = new ZKVerifier();
        console.log("ZKVerifier deployed:           ", address(verifier));

        // 3. Deploy RoyaltyDistributor — immutable, no proxy, no upgrade path
        RoyaltyDistributor dist = new RoyaltyDistributor(address(btt), address(verifier));
        console.log("RoyaltyDistributor deployed:   ", address(dist));

        // 4. Fund distributor with initial BTT from deployer
        btt.transfer(address(dist), 100_000_000 * 1e18);

        // 5. Deploy SoulboundNFT — ERC-5192 soulbound track registry
        SoulboundNFT sbt = new SoulboundNFT();
        console.log("SoulboundNFT deployed:         ", address(sbt));

        // 6. Deploy PublishingAgreement — wires to SoulboundNFT as its minter
        PublishingAgreement pa = new PublishingAgreement(address(sbt));
        console.log("PublishingAgreement deployed:  ", address(pa));

        // 7. Grant PublishingAgreement the minter role on SoulboundNFT.
        //    This is a one-time, irreversible permission — only PublishingAgreement
        //    can ever call SoulboundNFT.mint().
        sbt.setMinter(address(pa));
        console.log("SoulboundNFT.setMinter ->      ", address(pa));

        vm.stopBroadcast();

        // Print .env update instructions
        console.log("\n# Add these to .env:");
        console.log("BTT_CONTRACT_ADDR=            ", address(btt));
        console.log("ZK_VERIFIER_ADDR=             ", address(verifier));
        console.log("ROYALTY_CONTRACT_ADDR=        ", address(dist));
        console.log("SOULBOUND_NFT_ADDR=           ", address(sbt));
        console.log("PUBLISHING_AGREEMENT_ADDR=    ", address(pa));

        console.log("\n# Then set the ZK verifying key on-chain (after re-running ceremony):");
        console.log("# cargo run --bin ceremony -- --output vk.json");
        console.log("# cast send $ZK_VERIFIER_ADDR 'setVerifyingKey(...)' \\");
        console.log("#   $(cat vk.json | jq -r ...) \\");
        console.log("#   --ledger --hd-paths \"m/44'/60'/0'/0/0\" --rpc-url $BTTC_RPC_URL");

        console.log("\n# PublishingAgreement admin = deployer Ledger address");
        console.log("# The backend uses PUBLISHING_AGREEMENT_ADDR to call propose()");
        console.log("# Contributors sign agreements from their own wallets via the frontend");
    }
}
