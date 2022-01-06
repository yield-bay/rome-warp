// SPDX-License-Identifier: AGPL-3.0-or-later
// pragma solidity 0.7.5;
pragma solidity ^0.8.0;

// import "./IERC20.sol";

interface IStaking {
    function stake( uint _amount, address _recipient ) external returns ( bool );
    function claim( address _recipient ) external;
}