// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DepthGate} from "../src/DepthGate.sol";

contract DepthGateTest is Test {
    DepthGate gate;
    bytes32 constant SALT = keccak256("test-salt");
    uint256 constant FEE = 0.01 ether;
    address diver = address(0xD1);

    function h(uint8 z, string memory a) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(z, a, SALT));
    }

    function setUp() public {
        bytes32[5] memory hs = [h(0, "a0"), h(1, "a1"), h(2, "a2"), h(3, "a3"), h(4, "a4")];
        gate = new DepthGate(FEE, SALT, hs);
        vm.deal(diver, 1 ether);
    }

    function test_clearMintsBadgeAndPasses() public {
        vm.prank(diver);
        gate.clear(0, "a0");
        assertEq(gate.passedMask(diver), 1);
        assertEq(gate.badgeMask(diver), 1);
        assertEq(gate.clearedCount(0), 1);
    }

    function test_wrongAnswerReverts() public {
        vm.prank(diver);
        vm.expectRevert(DepthGate.WrongAnswer.selector);
        gate.clear(0, "nope");
    }

    function test_skipPassesWithoutBadge() public {
        vm.prank(diver);
        gate.skip{value: FEE}(2);
        assertEq(gate.passedMask(diver), 4);
        assertEq(gate.badgeMask(diver), 0);
        assertEq(gate.skippedCount(2), 1);
    }

    function test_skipUnderpaidReverts() public {
        vm.prank(diver);
        vm.expectRevert(DepthGate.FeeTooLow.selector);
        gate.skip{value: FEE - 1}(0);
    }

    function test_badZoneReverts() public {
        vm.prank(diver);
        vm.expectRevert(DepthGate.BadZone.selector);
        gate.skip{value: FEE}(5);
    }

    function test_reclearDoesNotDoubleCount() public {
        vm.startPrank(diver);
        gate.clear(1, "a1");
        gate.clear(1, "a1");
        vm.stopPrank();
        assertEq(gate.clearedCount(1), 1);
    }

    function test_withdrawOnlyOwner() public {
        vm.prank(diver);
        gate.skip{value: FEE}(0);
        vm.prank(diver);
        vm.expectRevert(DepthGate.NotOwner.selector);
        gate.withdraw();
        uint256 before = address(this).balance;
        gate.withdraw();
        assertEq(address(this).balance - before, FEE);
    }

    receive() external payable {}
}
