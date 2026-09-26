// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Into The Unknown. Passage is purchasable; the badge is not.
contract DepthGate {
    uint8 public constant ZONES = 5;

    address public immutable owner;
    uint256 public immutable skipFee;
    bytes32 private immutable salt;

    mapping(uint8 => bytes32) public answerHash;
    mapping(address => uint8) public passedMask;
    mapping(address => uint8) public badgeMask;
    mapping(uint8 => uint32) public clearedCount;
    mapping(uint8 => uint32) public skippedCount;

    event ZoneCleared(address indexed diver, uint8 indexed zone);
    event ZoneSkipped(address indexed diver, uint8 indexed zone);

    error BadZone();
    error WrongAnswer();
    error FeeTooLow();
    error NotOwner();

    constructor(uint256 _skipFee, bytes32 _salt, bytes32[5] memory hashes) {
        owner = msg.sender;
        skipFee = _skipFee;
        salt = _salt;
        for (uint8 i = 0; i < ZONES; i++) answerHash[i] = hashes[i];
    }

    function clear(uint8 zone, string calldata answer) external {
        if (zone >= ZONES) revert BadZone();
        if (keccak256(abi.encodePacked(zone, answer, salt)) != answerHash[zone]) revert WrongAnswer();
        uint8 bit = uint8(1) << zone;
        passedMask[msg.sender] |= bit;
        if (badgeMask[msg.sender] & bit == 0) {
            badgeMask[msg.sender] |= bit;
            clearedCount[zone] += 1;
        }
        emit ZoneCleared(msg.sender, zone);
    }

    function skip(uint8 zone) external payable {
        if (zone >= ZONES) revert BadZone();
        if (msg.value < skipFee) revert FeeTooLow();
        passedMask[msg.sender] |= uint8(1) << zone;
        skippedCount[zone] += 1;
        emit ZoneSkipped(msg.sender, zone);
    }

    function stats() external view returns (uint32[5] memory cleared, uint32[5] memory skipped) {
        for (uint8 i = 0; i < ZONES; i++) {
            cleared[i] = clearedCount[i];
            skipped[i] = skippedCount[i];
        }
    }

    function withdraw() external {
        if (msg.sender != owner) revert NotOwner();
        (bool ok,) = owner.call{value: address(this).balance}("");
        require(ok);
    }
}
