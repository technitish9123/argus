// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleReceiver {
    event Received(address indexed sender, uint256 amount, uint256 balance);
    event Called(address indexed sender, string message);

    receive() external payable {
        emit Received(msg.sender, msg.value, address(this).balance);
    }

    function ping(string calldata message) external payable returns (string memory) {
        emit Called(msg.sender, message);
        return message;
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
