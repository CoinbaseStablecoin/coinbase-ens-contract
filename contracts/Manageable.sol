// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.13;

import { Ownable } from "./openzeppelin/Ownable.sol";

/**
 * @dev Contract module which provides access control mechanism, where
 * there is a manager account (a signer manager, or a gateway manager) that
 * can be granted exclusive access to specific functions.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlySignerManager` and `onlyGatewayManager`, which can be applied to your
 * functions to restrict their use to the signer manager and the gateway
 * manager respectively.
 */
abstract contract Manageable is Ownable {
    address private _signerManager;
    address private _gatewayManager;

    event SignerManagerChanged(
        address indexed previousSignerManager,
        address indexed newSignerManager
    );

    event GatewayManagerChanged(
        address indexed previousGatewayManager,
        address indexed newGatewayManager
    );

    /**
     * @notice Returns the address of the current signer manager.
     * @return address the signer manager address.
     */
    function signerManager() public view virtual returns (address) {
        return _signerManager;
    }

    /**
     * @notice Returns the address of the current gateway manager.
     * @return address the gateway manager address.
     */
    function gatewayManager() public view virtual returns (address) {
        return _gatewayManager;
    }

    /**
     * @dev Throws if called by any account other than the signer manager.
     */
    modifier onlySignerManager() {
        require(
            _signerManager == _msgSender(),
            "Manageable: caller is not the signer manager"
        );
        _;
    }

    /**
     * @dev Throws if called by any account other than the gateway manager.
     */
    modifier onlyGatewayManager() {
        require(
            _gatewayManager == _msgSender(),
            "Manageable: caller is not the gateway manager"
        );
        _;
    }

    /**
     * @notice Change signer manager of the contract to a new account (`newSignerManager`).
     * Can only be called by the current owner.
     * @param newSignerManager the new signer manager address.
     */
    function changeSignerManager(address newSignerManager)
        public
        virtual
        onlyOwner
    {
        require(
            newSignerManager != address(0),
            "Manageable: new signer manager is the zero address"
        );
        _changeSignerManager(newSignerManager);
    }

    /**
     * @notice Change gateway manager of the contract to a new account (`newGatewayManager`).
     * Can only be called by the current owner.
     * @param newGatewayManager the new gateway manager address.
     */
    function changeGatewayManager(address newGatewayManager)
        public
        virtual
        onlyOwner
    {
        require(
            newGatewayManager != address(0),
            "Manageable: new gateway manager is the zero address"
        );
        _changeGatewayManager(newGatewayManager);
    }

    /**
     * @dev Change signer manager of the contract to a new account (`newSignerManager`).
     * Internal function without access restriction.
     */
    function _changeSignerManager(address newSignerManager) internal virtual {
        address oldSignerManager = _signerManager;
        _signerManager = newSignerManager;
        emit SignerManagerChanged(oldSignerManager, newSignerManager);
    }

    /**
     * @dev Change gateway manager of the contract to a new account (`newGatewayManager`).
     * Internal function without access restriction.
     */
    function _changeGatewayManager(address newGatewayManager) internal virtual {
        address oldGatewayManager = _gatewayManager;
        _gatewayManager = newGatewayManager;
        emit GatewayManagerChanged(oldGatewayManager, newGatewayManager);
    }
}
