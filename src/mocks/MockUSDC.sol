// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice A permissionless, mintable stand-in stablecoin — testnet-only.
 * @dev CC3 testnet has no real bridged stablecoin at a known address, so
 *      `Bond`'s collateral allowlist had nothing working to point at. This
 *      exists so `Bond.post()` has a real ERC20 to pull from, with the same
 *      6-decimal convention the rest of Dokett assumes (see `units()` in
 *      the Console's format helpers). `mint` is open to anyone — there is no
 *      real value here, only enough of a token for the demo to be honest
 *      about what a bond actually does on-chain.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
