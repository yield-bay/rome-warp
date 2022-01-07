// SPDX-License-Identifier: AGPL-3.0-or-later
// pragma solidity 0.7.5;
pragma solidity ^0.8.0;

import "./IERC20.sol";

interface IROME is IERC20 {
  function mint(address account_, uint256 amount_) external;

  function burn(uint256 amount) external;

  function burnFrom(address account_, uint256 amount_) external;
}
