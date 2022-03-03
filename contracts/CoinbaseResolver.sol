// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.12;

import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { Ownable } from "./openzeppelin/Ownable.sol";
import { IExtendedResolver } from "./ens-offchain-resolver/IExtendedResolver.sol";
import { SignatureVerifier } from "./ens-offchain-resolver/SignatureVerifier.sol";
import { IResolverService } from "./ens-offchain-resolver/IResolverService.sol";

/**
 * @notice Coinbase Offchain ENS Resolver
 * @dev Adapted from: https://github.com/ensdomains/offchain-resolver/blob/2bc616f19a94370828c35f29f71d5d4cab3a9a4f/packages/contracts/contracts/OffchainResolver.sol
 */
contract CoinbaseResolver is
    UUPSUpgradeable,
    Ownable,
    ERC165,
    IExtendedResolver
{
    bool private _initialized;
    string private _url;
    mapping(address => bool) private _signers;

    event UrlSet(string indexed newUrl);
    event SignersAdded(address[] indexed addedSigners);
    event SignersRemoved(address[] indexed removedSigners);
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    /**
     * @notice Initialize the contract with the initial parameters. Used in
     * lieu of a constructor to enable the use of a proxy contract.
     * @dev Can only be called once.
     * @param newOwner Owner address
     * @param newUrl Gateway URL
     * @param newSigners Signer addresses
     */
    function initialize(
        address newOwner,
        string memory newUrl,
        address[] memory newSigners
    ) external {
        require(!_initialized, "already initialized");

        _transferOwnership(newOwner);
        _setUrl(newUrl);
        _addSigners(newSigners);

        _initialized = true;
    }

    /**
     * @notice Returns the gateway URL.
     * @return Gateway URL
     */
    function url() external view returns (string memory) {
        return _url;
    }

    /**
     * @notice Returns whether a given account is a signer.
     * @return True if a given account is a signer.
     */
    function isSigner(address account) external view returns (bool) {
        return _signers[account];
    }

    /**
     * @notice Returns the implementation address.
     * @return Implementation address
     */
    function implementation() external view onlyProxy returns (address) {
        return _getImplementation();
    }

    /**
     * @notice Set the gateway URL.
     * @dev Can only be called by the owner.
     * @param newUrl New gateway URL
     */

    function setUrl(string memory newUrl) external onlyOwner {
        _setUrl(newUrl);
    }

    /**
     * @notice Add a set of new signers.
     * @dev Can only be called by the owner.
     * @param signersToAdd Signer addresses
     */
    function addSigners(address[] memory signersToAdd) external onlyOwner {
        _addSigners(signersToAdd);
    }

    /**
     * @notice Remove a set of existing signers.
     * @dev Can only be called by the owner.
     * @param signersToRemove Signer addresses
     */
    function removeSigners(address[] memory signersToRemove)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < signersToRemove.length; i++) {
            delete _signers[signersToRemove[i]];
        }
        emit SignersRemoved(signersToRemove);
    }

    /**
     * @notice Support ERC-165 introspection
     * @param interfaceID Interface ID
     * @return True if a given interface ID is supported.
     */
    function supportsInterface(bytes4 interfaceID)
        public
        view
        override
        returns (bool)
    {
        return
            interfaceID == type(IExtendedResolver).interfaceId ||
            super.supportsInterface(interfaceID);
    }

    /**
     * @notice Initiate a resolution conforming to the ENSIP-10. Reverts with an
     * an OffchainLookup error.
     * @param name DNS-encoded name to resolve
     * @param data ABI-encoded data for the underlying resolution function (e.g. addr(bytes32), text(bytes32,string))
     * @return Always reverts with an OffchainLookup error
     */
    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        override
        returns (bytes memory)
    {
        bytes memory callData = abi.encodeWithSelector(
            IResolverService.resolve.selector,
            name,
            data
        );
        string[] memory urls = new string[](1);
        urls[0] = _url;
        revert OffchainLookup(
            address(this),
            urls,
            callData,
            this.resolveWithProof.selector,
            callData
        );
    }

    /**
     * @notice Callback used by CCIP-read compatible clients to verify and parse the response.
     * @dev Reverts if the signature is invalid.
     * @param response ABI-encoded response data in the form of (bytes result, uint64 expires, bytes signature)
     * @param extraData Original request data
     * @return ABI-encoded result data for the underlying resolution function
     */
    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        (address signer, bytes memory result) = SignatureVerifier.verify(
            extraData,
            response
        );
        require(_signers[signer], "invalid signature");
        return result;
    }

    /**
     * @notice Generates a hash for signing and verifying the offchain response
     * @param expires Time at which the signature expires
     * @param request Request data
     * @param result Result data
     * @return Hashed data for signing and verifying
     */
    function makeSignatureHash(
        uint64 expires,
        bytes memory request,
        bytes memory result
    ) external view returns (bytes32) {
        return
            SignatureVerifier.makeSignatureHash(
                address(this),
                expires,
                request,
                result
            );
    }

    function _setUrl(string memory newUrl) private {
        _url = newUrl;
        emit UrlSet(newUrl);
    }

    function _addSigners(address[] memory signersToAdd) private {
        for (uint256 i = 0; i < signersToAdd.length; i++) {
            _signers[signersToAdd[i]] = true;
        }
        emit SignersAdded(signersToAdd);
    }

    /**
     * @dev Upgrades can only be performed by the owner
     */
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /**
     * @dev Disabled. Use .upgradeToAndCall instead.
     */
    function upgradeTo(address) external view override onlyProxy {
        revert("disabled");
    }
}
