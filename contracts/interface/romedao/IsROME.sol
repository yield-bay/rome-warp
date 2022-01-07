// SPDX-License-Identifier: AGPL-3.0-or-later
// pragma solidity 0.7.5;
pragma solidity ^0.8.0;

interface IsROME {
    function rebase( uint256 romeProfit_, uint epoch_) external returns (uint256);

    function circulatingSupply() external view returns (uint256);

    function balanceOf(address who) external view returns (uint256);

    function gonsForBalance( uint amount ) external view returns ( uint );

    function balanceForGons( uint gons ) external view returns ( uint );
    
    function index() external view returns ( uint );
    
    // addn
    function approve( address spender, uint256 value ) external returns (bool);

    // addn
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    // addn
    function transfer(address recipient, uint256 amount) external returns (bool);
}
