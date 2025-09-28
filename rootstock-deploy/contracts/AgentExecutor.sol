// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentExecutor
 * @notice Minimal contract for Argus agents to log and simulate DeFi actions on Rootstock.
 */
contract AgentExecutor {
    struct Action {
        address agent;
        string actionType;
        uint256 amount;
        uint256 timestamp;
    }

    Action[] public actions;
    mapping(address => uint256) public balances;

    event ActionExecuted(address indexed agent, string actionType, uint256 amount, uint256 timestamp);

    function deposit() external payable {
        require(msg.value > 0, "Deposit must be > 0");
        balances[msg.sender] += msg.value;
        _recordAction(msg.sender, "deposit", msg.value);
    }

    function borrow(uint256 amount) external {
        require(balances[msg.sender] > 0, "No collateral deposited");
        _recordAction(msg.sender, "borrow", amount);
    }

    /**
     * @notice Record an on-chain strategy run triggered by an agent
     * @param name The strategy name or DSL identifier
     */
    function runStrategy(string calldata name) external {
        // Record as an action so auditors/judges can see the DSL name onchain
        _recordAction(msg.sender, string(abi.encodePacked("runStrategy:", name)), 0);
    }

    function _recordAction(address agent, string memory actionType, uint256 amount) internal {
        Action memory act = Action({
            agent: agent,
            actionType: actionType,
            amount: amount,
            timestamp: block.timestamp
        });
        actions.push(act);
        emit ActionExecuted(agent, actionType, amount, block.timestamp);
    }

    function getActionCount() external view returns (uint256) {
        return actions.length;
    }
}
