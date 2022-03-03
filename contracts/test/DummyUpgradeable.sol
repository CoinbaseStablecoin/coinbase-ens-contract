// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.12;

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { StorageSlot } from "@openzeppelin/contracts/utils/StorageSlot.sol";

contract DummyUpgradeable is UUPSUpgradeable {
    bytes32 internal constant _VALUE_SLOT = keccak256("dummy.value");

    function value() external view returns (uint256) {
        return StorageSlot.getUint256Slot(_VALUE_SLOT).value;
    }

    function setValue(uint256 newValue) external {
        StorageSlot.getUint256Slot(_VALUE_SLOT).value = newValue;
    }

    function implementation() external view onlyProxy returns (address) {
        return _getImplementation();
    }

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override {}
}
