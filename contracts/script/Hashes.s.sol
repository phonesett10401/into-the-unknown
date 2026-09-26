// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

/// Prints the five constructor answer hashes for the real quiz.
contract Hashes is Script {
    function run() external pure {
        bytes32 s = 0x5188cb90642de1c5fe279bafe5fad2f456fb6027d845bb10cc474d6a276968bd;
        string[5] memory a = [
            "Photosynthesis",
            "About 90%",
            "RMS Titanic",
            "The falling remains of everything that died above",
            "No fish at all - it is close to the physiological limit"
        ];
        for (uint8 i = 0; i < 5; i++) {
            console.logBytes32(keccak256(abi.encodePacked(i, a[i], s)));
        }
    }
}
