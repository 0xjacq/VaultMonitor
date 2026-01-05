/**
 * Alert Helpers - Generate consistent alert IDs (TypeScript version)
 */
import * as crypto from 'crypto';

export function generateAlertId(
    probeId: string,
    ruleId: string,
    stableKey: string
): string {
    return `${probeId}:${ruleId}:${stableKey}`;
}

export function createHash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 8);
}

export function generateThresholdAlertId(probeId: string, ruleId: string): string {
    return generateAlertId(probeId, ruleId, 'breach');
}

export function generateChangeAlertId(
    probeId: string,
    ruleId: string,
    oldValue: any,
    newValue: any
): string {
    const stableKey = createHash(`${oldValue}->${newValue}`);
    return generateAlertId(probeId, ruleId, stableKey);
}

export function generateEventAlertId(
    probeId: string,
    ruleId: string,
    eventIdentifier: string
): string {
    return generateAlertId(probeId, ruleId, eventIdentifier);
}
