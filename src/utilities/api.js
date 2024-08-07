// OpenLI Provisioner Web Interface
// Copyright (C) 2023 The University of Waikato, Hamilton, New Zealand. All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

import {
    dateStringToUnixTimestamp,
    unixTimestampToDateString,
    isArray,
    isDict,
    isString,
    parseNumericString,
    split
} from "./utils";
import { valid, validateAPIInput } from "./validation";

function outputhandoversToString(oh_val) {
    if (oh_val === 0) {
        return "IRIs and CCs";
    } else if (oh_val === 1) {
        return "IRIs only";
    } else if (oh_val === 2) {
        return "CCs only";
    } else {
        return "Invalid value";
    }
}

function stringToOutputhandovers(oh_str) {
    if (oh_str === "IRIs and CCs") {
        return 0;
    } else if (oh_str === "IRIs only") {
        return 1;
    } else if (oh_str === "CCs only") {
        return 2;
    }
    return 0;
}

function deliverCompressToString(dc_val) {
    if (dc_val === "as-is") {
        return "As is";
    } else if (dc_val === "inflated" || dc_val === "decompressed") {
        return "Decompressed";
    } else if (dc_val === "default") {
        return "Use default";
    }
    return "Use default";
}

function stringToDeliverCompress(dc_str) {
    if (dc_str === "As is") {
        return "as-is";
    } else if (dc_str === "Decompressed") {
        return "decompressed";
    }
    return "default";
}

function encryptionMethodToString(em_val) {

    if (em_val === "none") {
        return "No encryption";
    } else if (em_val === "aes-192-cbc") {
        return "AES-192-CBC";
    }
    return "Invalid encryption method?"
}

function stringToEncryptionMethod(em_str) {
    if (em_str === "No encryption") {
        return "none";
    } else if (em_str === "AES-192-CBC") {
        return "aes-192-cbc";
    }
    return "none";
}

function objectKey(object, objectType) {
    const delimiter = "key_delimiter" in objectType.api ? objectType.api.key_delimiter : "-";
    const objectKey = [];
    for(const key of objectType.api.key) {
        if(key in object) {
            objectKey.push(object[key]);
        } else {
            return null;
        }
    }
    return objectKey.join(delimiter);
}

function fieldLabel(routeField) {
    return routeField.label || routeField.name;
}

function listFields(objectType) {
    return objectType.route.list_fields || objectType.api.key;
}

function initialiseAPIData(apiFields, data={}) {
    for(const [key, apiField] of Object.entries(apiFields)) {
        if(key in data) {
            data[key] = initialiseAPIDataField(apiField, data[key]);
        } else {
            data[key] = initialAPIDataValue(apiField);
        }
    }
    return data;
}

function initialiseAPIDataField(apiField, data) {
    if(apiField.type === "dict") {
        if(isDict(data)) {
            return initialiseAPIData(apiField.fields, data);
        } else {
            return initialAPIDataValue(apiField);
        }
    } else if(apiField.type === "list") {
        if(isArray(data)) {
            for(const [i, value] of data.entries()) {
                data[i] = initialiseAPIDataField(apiField.elements, value);
            }
            return data;
        } else {
            return initialAPIDataValue(apiField);
        }
    } else {
        if(data instanceof Object) {
            return initialAPIDataValue(apiField);
        } else {
            return data;
        }
    }
}

function initialAPIDataValue(apiField) {
    if(apiField.default) {
        return apiField.default;
    } else if(apiField.type === "dict") {
        return initialiseAPIData(apiField.fields);
    } else if(apiField.type === "list") {
        if(apiField.required) {
            return [initialAPIDataValue(apiField.elements)];
        } else {
            return [];
        }
    } else if (apiField.type === "select" && apiField.defaultval) {
        return apiField.defaultval;
    } else {
        return "";
    }
}

function validateAPIData(apiFields, data={}, config) {
    let isValid = true;
    const validation = {};

    for(const [key, apiField] of Object.entries(apiFields)) {
        if(key in data && isNavigationAPISupported(apiField.minversion,
                config.openliversion)) {
            const [valid, field] = validateAPIField(apiField, data[key], config);
            if(!valid) {
                isValid = false;
            } else if (key === "encryptionkey") {
                if (data[key].length === 0 && "payloadencryption" in data) {
                    if (data["payloadencryption"] !== "No encryption") {
                        isValid = false;
                        field["feedback"] = "must be set if encryption is enabled";                     field["invalid"] = true;
                    }
                }
            } else if (key === "mobileident") {
                if (data[key] === "Undetermined" && "accesstype" in data) {
                    if (data["accesstype"] === "mobile") {
                        isValid = false;
                        field["feedback"] = "must be set to a valid identifier type for mobile intercepts";
                        field["invalid"] = true;
                    }
                }
            }
            validation[key] = field;
        } else {
            validation[key] = initialAPIValidationValue(apiField);
        }
    }

    return [isValid, validation];
}

function validateAPIField(apiField, data, config) {
    if(apiField.type === "dict") {
        if(isDict(data)) {
            return validateAPIData(apiField.fields, data, config);
        } else {
            return [true, initialAPIValidationValue(apiField)];
        }
    } else if(apiField.type === "list") {
        if(isArray(data)) {
            let isValid = true;
            const validation = [];

            for(const value of data) {
                const [valid, field] = validateAPIField(apiField.elements, value, config);

                if(!valid) {
                    isValid = false;
                }

                validation.push(field);
            }

            return [isValid, validation];
        } else {
            return [true, initialAPIValidationValue(apiField)];
        }
    } else {
        if(data instanceof Object) {
            return [true, initialAPIValidationValue(apiField)];
        } else {
            const validation = validateAPIInput(apiField, data);
            return [!validation.invalid, validation];
        }
    }
}

function initialAPIValidationValue(apiField) {
    if(apiField.type === "dict") {
        return validateAPIData(apiField.fields)[1];
    } else if(apiField.type === "list") {
        if(apiField.required) {
            return [initialAPIValidationValue(apiField.elements)];
        } else {
            return [];
        }
    } else {
        return valid();
    }
}

function formatAPIData(apiFields, data, reverse=false) {
    for(const [key, apiField] of Object.entries(apiFields)) {
        if(key in data) {
            let outputkey = key;
            if ( key === "mobileident" ) {
                if ( "accesstype" in data ) {
                    if (data["accesstype"] !== "mobile") {
                        continue;
                    }
                } else {
                    continue;
                }
            }

            data[outputkey] = formatAPIDataField(key, apiField,
                    data[key], reverse);
        }
    }
    return data;
}

function formatAPIDataField(key, apiField, data, reverse=false) {
    if(apiField.type === "dict") {
        if(isDict(data)) {
            return formatAPIData(apiField.fields, data, reverse);
        } else {
            return data;
        }
    } else if(apiField.type === "list") {
        if(isArray(data)) {
            for(const [i, value] of data.entries()) {
                data[i] = formatAPIDataField(i, apiField.elements, value,
                        reverse);
            }
            return data;
        } else {
            return data;
        }
    } else {
        if(data instanceof Object) {
            return data;
        } else if(apiField.type === "unix_timestamp"){
            if(reverse) {
                return unixTimestampToDateString(data);
            } else {
                return dateStringToUnixTimestamp(data);
            }
        } else if (key === "outputhandovers") {
            if(reverse) {
                return outputhandoversToString(data);
            } else {
                return stringToOutputhandovers(data);
            }
        } else if (key === "payloadencryption") {
            if (reverse) {
                return encryptionMethodToString(data);
            } else {
                return stringToEncryptionMethod(data);
            }
        } else if (key === "delivercompressed" ||
                    key === "email-defaultdelivercompressed") {
            if (reverse) {
                return deliverCompressToString(data);
            } else {
                return stringToDeliverCompress(data);
            }
        } else {
            return data;
        }
    }
}

function toAPIObject(objectType, data) {
    if(isDict(data)) {
        return data;
    }

    const dict = {};
    const keycount = objectType.api.key.length;

    if(isArray(data)) {
        for(const [i, value] of data.entries()) {
            if(i in objectType.api.key) {
                dict[objectType.api.key[i]] = value;
            }
        }
    } else if(isString(data) && keycount > 0) {
        const delimiter = "key_delimiter" in objectType.api ? objectType.api.key_delimiter : "-";
        for(const [i, value] of split(data, delimiter, keycount - 1).entries()) {
            dict[objectType.api.key[i]] = value;
        }
    } else if(isString(data)) {
	// TODO?	
    } else {
	if (objectType.api.key.length > 0) {
            dict[objectType.api.key[0]] = data;
	}
    }
    return dict;
}

function sortAPIObjects(objectType, objects) {
    /* filter out objects that do not contain all the required key
     * fields
     */

    /* but in the case of coreservers that are defined using a single
     * port number (i.e. legacy mode), we can convert the port entry into
     * lower and upper fields that have the same value...
     */
    // TODO add other server types
    const coreserverRoutes = ["sipserver", "radiusserver"];
    let filtered = [];
    for (const obj of objects) {
        let ok = true;

        if (coreserverRoutes.includes(objectType.route.name)) {
            if (obj["port"] !== undefined && (obj["port_upper"] === undefined
                    && obj["port_lower"] === undefined)) {
                obj["port_lower"] = obj["port"];
                obj["port_upper"] = obj["port"];
            }
        }

        for (const f of objectType.api.key) {
            if (obj[f] === undefined) {
                ok = false;
                break;
            }
        }
        if (ok) {
            filtered.push(obj);
        }
    }
    objects = filtered;

    if ("key" in objectType.api && objectType.api.key.length !== 0) {
        objects.sort((a,b) => {
	        /* handle case where the objects are just strings (e.g.
	         * defaultradius)
	        */
    	    if (typeof a === 'string' && typeof b === 'string') {
    		    return a.localeCompare(b);
	        }

            for (const f of objectType.api.key) {
                if (a[f] === undefined && b[f] !== undefined) {
                    return 1;
                } else if (a[f] !== undefined && b[f] === undefined) {
                    return -1;
                } else if (a[f] === undefined && b[f] === undefined) {
                    return 0;
                }

                if (a[f].toLowerCase() < b[f].toLowerCase()) {
                    return -1;
                } else if (a[f].toLowerCase() > b[f].toLowerCase()) {
                    return 1;
                }
            }
            return 0;
        });
    } else {
	objects.sort((a,b) => {
	    if (typeof a === 'string' && typeof b === 'string') {
		return a.localeCompare(b);
	    }
	    if (typeof a === 'number' && typeof b === 'number') {
		return a - b;
	    }
	    if (typeof a === 'number') {
		return -1;
	    }
	    if (typeof b === 'string') {
		return 1;
	    }
	    return 0;
	});
    }
    return objects;
}

function isNavigationAPISupported(minversion, openliversion, maxversion) {

    if ((minversion === undefined && maxversion === undefined) ||
            openliversion === undefined) {
        return true;
    }

    if (minversion !== undefined) {
        let minv_parts = minversion.split('.');
        if (minv_parts.length === 3) {
            minv_parts[0] = parseNumericString(minv_parts[0]);
            minv_parts[1] = parseNumericString(minv_parts[1]);
            minv_parts[2] = parseNumericString(minv_parts[2]);

            if (minv_parts[0] > openliversion.major) {
                return false;
            } else if (minv_parts[0] === openliversion.major) {
                if (minv_parts[1] > openliversion.minor) {
                    return false;
                } else if (minv_parts[1] === openliversion.minor) {
                    if (minv_parts[2] > openliversion.revision) {
                        return false;
                    }
                }
            }
        }
    }

    if (maxversion !== undefined) {
        let maxv_parts = maxversion.split('.');
        if (maxv_parts.length === 3) {
            maxv_parts[0] = parseNumericString(maxv_parts[0]);
            maxv_parts[1] = parseNumericString(maxv_parts[1]);
            maxv_parts[2] = parseNumericString(maxv_parts[2]);

            if (maxv_parts[0] < openliversion.major) {
                return false;
            } else if (maxv_parts[0] === openliversion.major) {
                if (maxv_parts[1] < openliversion.minor) {
                    return false;
                } else if (maxv_parts[1] === openliversion.minor) {
                    if (maxv_parts[2] < openliversion.revision) {
                        return false;
                    }
                }
            }
        }
    }

    return true;
}

export {
    objectKey,
    initialiseAPIData,
    initialAPIDataValue,
    validateAPIData,
    initialAPIValidationValue,
    fieldLabel,
    listFields,
    formatAPIData,
    toAPIObject,
    sortAPIObjects,
    isNavigationAPISupported
};
