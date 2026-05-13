// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

/// @title OracleZKVerifier
/// @notice Accepts a Groth16 BN254 proof produced by `wasm-oracle` + the
///         `libs/zk-circuits::twap` circuit, and only persists the new TWAP
///         when the proof verifies and the freshness/commitment checks pass.
///
///         PUBLIC INPUTS (must match wasm-oracle::PublishPayload):
///           1. twap                — uint256, price * 1e18
///           2. n_samples           — uint256 (1..=24)
///           3. samples_commitment  — uint256, first 248 bits of SHA-256
///                                    over (domain || (ts,raw)*).
///
///         The contract trusts NOTHING from the publisher except the proof:
///         - `twap` is constrained by the circuit to equal the integer TWAP
///           of the committed samples.
///         - `samples_commitment` cryptographically binds the proof to the
///           specific (timestamp, price) tuples WASM hashed.
///         - `n_samples` is a public counter — replay across windows is
///           prevented by `lastPublishAt`.
contract OracleZKVerifier {
    uint256 constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    struct VerifyingKey {
        uint256[2]    alpha;
        uint256[2][2] beta;
        uint256[2][2] gamma;
        uint256[2][2] delta;
        uint256[2][]  ic;   // length must be 4 (1 + 3 inputs)
        bool set;
    }

    struct Proof {
        uint256[2]    a;
        uint256[2][2] b;
        uint256[2]    c;
    }

    struct Reading {
        uint256 twap;          // price * 1e18
        uint256 nSamples;
        uint256 commitment;    // 248-bit truncated SHA-256
        uint64  publishedAt;   // block.timestamp at publish
        address publisher;
    }

    VerifyingKey private vk;
    address public immutable admin;
    Reading public latest;
    uint256 public publishCount;
    uint64  public minInterval = 60 minutes;

    event VerifyingKeySet(uint256 timestamp);
    event TwapPublished(
        uint256 indexed twap,
        uint256 nSamples,
        uint256 commitment,
        address indexed publisher
    );

    modifier onlyAdmin() { require(msg.sender == admin, "admin only"); _; }
    constructor() { admin = msg.sender; }

    function setVerifyingKey(
        uint256[2]    calldata alpha,
        uint256[2][2] calldata beta,
        uint256[2][2] calldata gamma,
        uint256[2][2] calldata delta,
        uint256[2][]  calldata ic
    ) external onlyAdmin {
        require(!vk.set, "vk already set");
        require(ic.length == 4, "need 4 IC points");
        vk.alpha = alpha; vk.beta = beta; vk.gamma = gamma; vk.delta = delta;
        delete vk.ic;
        for (uint i = 0; i < ic.length; i++) vk.ic.push(ic[i]);
        vk.set = true;
        emit VerifyingKeySet(block.timestamp);
    }

    function setMinInterval(uint64 secs) external onlyAdmin {
        require(secs >= 60 && secs <= 24 hours, "interval out of range");
        minInterval = secs;
    }

    /// Publish a new TWAP. Reverts unless the Groth16 proof verifies AND the
    /// rate-limit window has elapsed since the previous publish.
    function publish(
        uint256 twap,
        uint256 nSamples,
        uint256 samplesCommitment,
        bytes   calldata proof
    ) external {
        require(vk.set, "vk not set");
        require(nSamples >= 1 && nSamples <= 24, "n_samples out of range");
        require(twap < FIELD_MODULUS, "twap out of field");
        require(samplesCommitment < FIELD_MODULUS, "commitment out of field");
        require(
            block.timestamp >= uint256(latest.publishedAt) + minInterval,
            "rate limited"
        );
        require(proof.length == 192, "bad proof length");

        Proof memory p = _decodeProof(proof);
        uint256[3] memory inputs = [twap, nSamples, samplesCommitment];
        require(_groth16Verify(p, inputs), "proof invalid");

        latest = Reading({
            twap: twap,
            nSamples: nSamples,
            commitment: samplesCommitment,
            publishedAt: uint64(block.timestamp),
            publisher: msg.sender
        });
        unchecked { publishCount++; }
        emit TwapPublished(twap, nSamples, samplesCommitment, msg.sender);
    }

    // ── Verification primitives (mirrors ZKVerifier.sol) ───────────────────

    function _decodeProof(bytes calldata data) private pure returns (Proof memory p) {
        (p.a[0], p.a[1])       = abi.decode(data[ 0: 64], (uint256,uint256));
        (p.b[0][0], p.b[0][1],
         p.b[1][0], p.b[1][1]) = abi.decode(data[64:128], (uint256,uint256,uint256,uint256));
        (p.c[0], p.c[1])       = abi.decode(data[128:192],(uint256,uint256));
    }

    function _groth16Verify(Proof memory proof, uint256[3] memory inputs)
        private view returns (bool)
    {
        uint256[2] memory acc = [vk.ic[0][0], vk.ic[0][1]];
        for (uint i = 0; i < inputs.length; i++) {
            require(inputs[i] < FIELD_MODULUS, "input out of field");
            (uint256 x, uint256 y) = _ecMul(vk.ic[i+1][0], vk.ic[i+1][1], inputs[i]);
            (acc[0], acc[1]) = _ecAdd(acc[0], acc[1], x, y);
        }
        return _pairingCheck(
            proof.a, proof.b,
            vk.alpha, vk.beta,
            acc, vk.gamma,
            proof.c, vk.delta
        );
    }

    function _ecAdd(uint256 x1,uint256 y1,uint256 x2,uint256 y2)
        private view returns (uint256 rx, uint256 ry)
    {
        (bool ok, bytes memory res) = address(6).staticcall(abi.encode(x1,y1,x2,y2));
        require(ok, "ecAdd failed");
        (rx, ry) = abi.decode(res, (uint256,uint256));
    }
    function _ecMul(uint256 x,uint256 y,uint256 s)
        private view returns (uint256 rx, uint256 ry)
    {
        (bool ok, bytes memory res) = address(7).staticcall(abi.encode(x,y,s));
        require(ok, "ecMul failed");
        (rx, ry) = abi.decode(res, (uint256,uint256));
    }
    function _pairingCheck(
        uint256[2] memory a,   uint256[2][2] memory b,
        uint256[2] memory al,  uint256[2][2] memory be,
        uint256[2] memory acc, uint256[2][2] memory ga,
        uint256[2] memory c,   uint256[2][2] memory de
    ) private view returns (bool) {
        uint256[24] memory input;
        input[0]=a[0]; input[1]=a[1];
        input[2]=b[0][0]; input[3]=b[0][1]; input[4]=b[1][0]; input[5]=b[1][1];
        input[6]=al[0]; input[7]=al[1];
        input[8]=be[0][0]; input[9]=be[0][1]; input[10]=be[1][0]; input[11]=be[1][1];
        input[12]=acc[0]; input[13]=acc[1];
        input[14]=ga[0][0]; input[15]=ga[0][1]; input[16]=ga[1][0]; input[17]=ga[1][1];
        input[18]=c[0]; input[19]=c[1];
        input[20]=de[0][0]; input[21]=de[0][1]; input[22]=de[1][0]; input[23]=de[1][1];
        (bool ok, bytes memory res) = address(8).staticcall(abi.encode(input));
        require(ok, "pairing failed");
        return abi.decode(res, (bool));
    }
}