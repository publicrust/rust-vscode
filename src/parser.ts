export interface ParsedHook {
    name: string;
    parameters: string[];
    namespace?: string;
}

export function parseHook(hookSignature: string): ParsedHook {
    // Remove leading/trailing whitespace and 'void' if present
    const cleanSignature = hookSignature.trim().replace(/^void\s+/, '');
    
    // Extract method name and parameters
    const methodMatch = cleanSignature.match(/^([\w.]+)\s*\((.*)\)$/);
    if (!methodMatch) {
        return { name: cleanSignature, parameters: [] };
    }

    const [, fullName, paramString] = methodMatch;
    
    // Handle namespace
    const nameParts = fullName.split('.');
    const name = nameParts[nameParts.length - 1];
    const namespace = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : undefined;
    
    // Parse parameters, handling complex types
    const parameters = paramString
        .split(',')
        .map(param => param.trim())
        .filter(param => param.length > 0)
        .map(param => {
            // Handle generic types
            if (param.includes('<')) {
                return normalizeGenericType(param);
            }
            return param;
        });

    return {
        name,
        parameters,
        namespace
    };
}

function normalizeGenericType(param: string): string {
    // Handle nested generic types like List<Dictionary<string, int>>
    let depth = 0;
    let normalized = '';
    
    for (let i = 0; i < param.length; i++) {
        const char = param[i];
        if (char === '<') {
            depth++;
            normalized += char;
        } else if (char === '>') {
            depth--;
            normalized += char;
        } else if (char === ',' && depth > 0) {
            normalized += '|'; // Use a different separator inside generic types
        } else {
            normalized += char;
        }
    }
    
    return normalized.replace(/\|/g, ',');
}

function isValidHookSignature(signature: string): boolean {
    const parsed = parseHook(signature);
    return parsed.name.length > 0 && parsed.parameters.every(param => {
        const parts = param.split(' ');
        return parts.length >= 2 && isValidType(parts[0]);
    });
}

function isValidType(type: string): boolean {
    // Basic C# types
    const basicTypes = [
        'string', 'int', 'bool', 'float', 'double', 'decimal',
        'byte', 'char', 'object', 'dynamic', 'var'
    ];
    
    // Handle array types
    if (type.endsWith('[]')) {
        return isValidType(type.slice(0, -2));
    }
    
    // Handle generic types
    if (type.includes('<')) {
        const baseType = type.split('<')[0];
        return /^[A-Z]\w*$/.test(baseType);
    }
    
    // Check if it's a basic type or starts with uppercase (likely a class name)
    return basicTypes.includes(type.toLowerCase()) || /^[A-Z]\w*$/.test(type);
}
