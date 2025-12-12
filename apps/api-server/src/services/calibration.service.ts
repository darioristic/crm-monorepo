/**
 * Tenant Match Calibration Service
 *
 * Implements per-tenant threshold calibration based on user feedback.
 * Adapts matching thresholds to improve accuracy over time.
 *
 * Based on Midday's calibration system.
 */

import { sql as db } from "../db/client";
import { serviceLogger } from "../lib/logger";

// ==============================================
// TYPES
// ==============================================

export interface TenantCalibration {
  tenantId: string;
  calibratedSuggestedThreshold: number;
  calibratedAutoThreshold: number;
  calibratedHighConfidenceThreshold: number;
  totalSuggestions: number;
  confirmedSuggestions: number;
  declinedSuggestions: number;
  unmatchedSuggestions: number;
  suggestedMatchAccuracy: number;
  avgConfidenceConfirmed: number | null;
  avgConfidenceDeclined: number | null;
  avgConfidenceUnmatched: number | null;
  lastCalibratedAt: string;
}

export interface CalibrationMetrics {
  accuracy: number;
  confidenceGap: number;
  totalFeedback: number;
  negativeFeedback: number;
}

// ==============================================
// CONSTANTS
// ==============================================

export const CALIBRATION_CONSTANTS = {
  // Default thresholds
  DEFAULT_SUGGESTED_THRESHOLD: 0.6,
  DEFAULT_AUTO_THRESHOLD: 0.9,
  DEFAULT_HIGH_CONFIDENCE_THRESHOLD: 0.72,

  // Calibration limits
  MAX_ADJUSTMENT: 0.03, // Max 3% adjustment per cycle
  MIN_SAMPLES_FOR_CALIBRATION: 5, // Minimum samples to activate calibration
  MIN_SAMPLES_CONSERVATIVE: 8, // For conservative adjustments
  LOOKBACK_DAYS: 90, // Rolling window for calibration data

  // Threshold bounds
  MIN_SUGGESTED_THRESHOLD: 0.55,
  MAX_SUGGESTED_THRESHOLD: 0.85,
  MIN_AUTO_THRESHOLD: 0.85,
  MAX_AUTO_THRESHOLD: 0.95,
} as const;

// ==============================================
// MAIN FUNCTIONS
// ==============================================

/**
 * Get calibration data for a tenant
 * Returns current thresholds and metrics
 */
export async function getCalibration(tenantId: string): Promise<TenantCalibration> {
  try {
    const result = await db`
      SELECT
        tenant_id,
        calibrated_suggested_threshold,
        calibrated_auto_threshold,
        calibrated_high_confidence_threshold,
        total_suggestions,
        confirmed_suggestions,
        declined_suggestions,
        unmatched_suggestions,
        suggested_match_accuracy,
        avg_confidence_confirmed,
        avg_confidence_declined,
        avg_confidence_unmatched,
        last_calibrated_at
      FROM tenant_match_calibration
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (result.length === 0) {
      // Return defaults if no calibration exists
      return getDefaultCalibration(tenantId);
    }

    const row = result[0] as Record<string, unknown>;

    return {
      tenantId: row.tenant_id as string,
      calibratedSuggestedThreshold: Number(row.calibrated_suggested_threshold),
      calibratedAutoThreshold: Number(row.calibrated_auto_threshold),
      calibratedHighConfidenceThreshold: Number(row.calibrated_high_confidence_threshold),
      totalSuggestions: Number(row.total_suggestions),
      confirmedSuggestions: Number(row.confirmed_suggestions),
      declinedSuggestions: Number(row.declined_suggestions),
      unmatchedSuggestions: Number(row.unmatched_suggestions),
      suggestedMatchAccuracy: Number(row.suggested_match_accuracy),
      avgConfidenceConfirmed: row.avg_confidence_confirmed
        ? Number(row.avg_confidence_confirmed)
        : null,
      avgConfidenceDeclined: row.avg_confidence_declined
        ? Number(row.avg_confidence_declined)
        : null,
      avgConfidenceUnmatched: row.avg_confidence_unmatched
        ? Number(row.avg_confidence_unmatched)
        : null,
      lastCalibratedAt: row.last_calibrated_at as string,
    };
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error getting calibration");
    return getDefaultCalibration(tenantId);
  }
}

/**
 * Update calibration based on recent feedback
 * Should be called periodically or after significant feedback
 */
export async function updateCalibration(tenantId: string): Promise<TenantCalibration> {
  try {
    // Get feedback data from last 90 days
    const feedbackData = await getFeedbackData(tenantId);

    if (feedbackData.totalFeedback < CALIBRATION_CONSTANTS.MIN_SAMPLES_FOR_CALIBRATION) {
      serviceLogger.info(
        { tenantId, samples: feedbackData.totalFeedback },
        "Not enough samples for calibration"
      );
      return getCalibration(tenantId);
    }

    // Calculate new thresholds
    const newThresholds = calculateCalibratedThresholds(feedbackData);

    // Upsert calibration record
    await db`
      INSERT INTO tenant_match_calibration (
        tenant_id,
        calibrated_suggested_threshold,
        calibrated_auto_threshold,
        calibrated_high_confidence_threshold,
        total_suggestions,
        confirmed_suggestions,
        declined_suggestions,
        unmatched_suggestions,
        suggested_match_accuracy,
        avg_confidence_confirmed,
        avg_confidence_declined,
        avg_confidence_unmatched,
        last_calibrated_at
      ) VALUES (
        ${tenantId},
        ${newThresholds.suggestedThreshold},
        ${newThresholds.autoThreshold},
        ${newThresholds.highConfidenceThreshold},
        ${feedbackData.totalFeedback},
        ${feedbackData.confirmed},
        ${feedbackData.declined},
        ${feedbackData.unmatched},
        ${feedbackData.accuracy},
        ${feedbackData.avgConfidenceConfirmed},
        ${feedbackData.avgConfidenceDeclined},
        ${feedbackData.avgConfidenceUnmatched},
        NOW()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        calibrated_suggested_threshold = ${newThresholds.suggestedThreshold},
        calibrated_auto_threshold = ${newThresholds.autoThreshold},
        calibrated_high_confidence_threshold = ${newThresholds.highConfidenceThreshold},
        total_suggestions = ${feedbackData.totalFeedback},
        confirmed_suggestions = ${feedbackData.confirmed},
        declined_suggestions = ${feedbackData.declined},
        unmatched_suggestions = ${feedbackData.unmatched},
        suggested_match_accuracy = ${feedbackData.accuracy},
        avg_confidence_confirmed = ${feedbackData.avgConfidenceConfirmed},
        avg_confidence_declined = ${feedbackData.avgConfidenceDeclined},
        avg_confidence_unmatched = ${feedbackData.avgConfidenceUnmatched},
        last_calibrated_at = NOW()
    `;

    serviceLogger.info(
      {
        tenantId,
        accuracy: feedbackData.accuracy,
        suggestedThreshold: newThresholds.suggestedThreshold,
        autoThreshold: newThresholds.autoThreshold,
      },
      "Calibration updated"
    );

    return getCalibration(tenantId);
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error updating calibration");
    throw error;
  }
}

/**
 * Reset calibration to defaults
 */
export async function resetCalibration(tenantId: string): Promise<void> {
  try {
    await db`
      DELETE FROM tenant_match_calibration
      WHERE tenant_id = ${tenantId}
    `;

    serviceLogger.info({ tenantId }, "Calibration reset to defaults");
  } catch (error) {
    serviceLogger.error({ error, tenantId }, "Error resetting calibration");
    throw error;
  }
}

// ==============================================
// HELPER FUNCTIONS
// ==============================================

interface FeedbackData {
  totalFeedback: number;
  confirmed: number;
  declined: number;
  unmatched: number;
  accuracy: number;
  avgConfidenceConfirmed: number | null;
  avgConfidenceDeclined: number | null;
  avgConfidenceUnmatched: number | null;
  confidenceGap: number;
}

async function getFeedbackData(tenantId: string): Promise<FeedbackData> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - CALIBRATION_CONSTANTS.LOOKBACK_DAYS);

  const result = await db`
    SELECT
      COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
      COUNT(*) FILTER (WHERE status = 'declined') as declined,
      COUNT(*) FILTER (WHERE status = 'unmatched') as unmatched,
      AVG(confidence_score) FILTER (WHERE status = 'confirmed') as avg_confirmed,
      AVG(confidence_score) FILTER (WHERE status = 'declined') as avg_declined,
      AVG(confidence_score) FILTER (WHERE status = 'unmatched') as avg_unmatched
    FROM transaction_match_suggestions
    WHERE tenant_id = ${tenantId}
      AND status IN ('confirmed', 'declined', 'unmatched')
      AND created_at > ${lookbackDate.toISOString()}
  `;

  const row = result[0] as Record<string, unknown>;
  const confirmed = Number(row.confirmed) || 0;
  const declined = Number(row.declined) || 0;
  const unmatched = Number(row.unmatched) || 0;
  const totalFeedback = confirmed + declined + unmatched;

  const avgConfirmed = row.avg_confirmed ? Number(row.avg_confirmed) : null;
  const avgDeclined = row.avg_declined ? Number(row.avg_declined) : null;
  const avgUnmatched = row.avg_unmatched ? Number(row.avg_unmatched) : null;

  // Calculate accuracy (confirmed / total)
  const accuracy = totalFeedback > 0 ? confirmed / totalFeedback : 0;

  // Calculate confidence gap (difference between confirmed and negative averages)
  const negativeFeedbackCount = declined + unmatched;
  const avgNegative =
    negativeFeedbackCount > 0
      ? ((avgDeclined || 0) * declined + (avgUnmatched || 0) * unmatched) / negativeFeedbackCount
      : null;

  const confidenceGap =
    avgConfirmed !== null && avgNegative !== null ? avgConfirmed - avgNegative : 0;

  return {
    totalFeedback,
    confirmed,
    declined,
    unmatched,
    accuracy,
    avgConfidenceConfirmed: avgConfirmed,
    avgConfidenceDeclined: avgDeclined,
    avgConfidenceUnmatched: avgUnmatched,
    confidenceGap,
  };
}

interface CalibratedThresholds {
  suggestedThreshold: number;
  autoThreshold: number;
  highConfidenceThreshold: number;
}

function calculateCalibratedThresholds(feedback: FeedbackData): CalibratedThresholds {
  let suggestedThreshold = CALIBRATION_CONSTANTS.DEFAULT_SUGGESTED_THRESHOLD;
  let autoThreshold = CALIBRATION_CONSTANTS.DEFAULT_AUTO_THRESHOLD;

  const { accuracy, confirmed, declined, unmatched, confidenceGap } = feedback;
  const negativeFeedback = declined + unmatched;

  // Adjust suggested threshold based on accuracy
  if (accuracy > 0.9 && confirmed >= CALIBRATION_CONSTANTS.MIN_SAMPLES_CONSERVATIVE) {
    // Excellent acceptance rate - can be slightly more aggressive
    suggestedThreshold = Math.max(
      CALIBRATION_CONSTANTS.MIN_SUGGESTED_THRESHOLD,
      suggestedThreshold - CALIBRATION_CONSTANTS.MAX_ADJUSTMENT
    );
  } else if (accuracy > 0.8 && confirmed >= CALIBRATION_CONSTANTS.MIN_SAMPLES_FOR_CALIBRATION) {
    // Good acceptance rate - small adjustment
    suggestedThreshold = Math.max(
      CALIBRATION_CONSTANTS.MIN_SUGGESTED_THRESHOLD,
      suggestedThreshold - CALIBRATION_CONSTANTS.MAX_ADJUSTMENT * 0.66
    );
  } else if (
    accuracy < 0.3 &&
    negativeFeedback >= CALIBRATION_CONSTANTS.MIN_SAMPLES_FOR_CALIBRATION
  ) {
    // Poor acceptance rate - be more conservative
    suggestedThreshold = Math.min(
      CALIBRATION_CONSTANTS.MAX_SUGGESTED_THRESHOLD,
      suggestedThreshold + CALIBRATION_CONSTANTS.MAX_ADJUSTMENT
    );
  }

  // Confidence gap analysis
  if (confidenceGap > 0.2) {
    // Clear separation between confirmed and negative - can be more aggressive
    suggestedThreshold = Math.max(
      CALIBRATION_CONSTANTS.MIN_SUGGESTED_THRESHOLD,
      suggestedThreshold - CALIBRATION_CONSTANTS.MAX_ADJUSTMENT * 0.5
    );
  } else if (confidenceGap < 0.08 && feedback.totalFeedback > 10) {
    // Poor separation - be more conservative
    suggestedThreshold = Math.min(
      CALIBRATION_CONSTANTS.MAX_SUGGESTED_THRESHOLD,
      suggestedThreshold + CALIBRATION_CONSTANTS.MAX_ADJUSTMENT * 0.5
    );
  }

  // Volume-based tuning
  if (confirmed > 25 && accuracy > 0.8) {
    // High engagement with good accuracy
    suggestedThreshold = Math.max(
      CALIBRATION_CONSTANTS.MIN_SUGGESTED_THRESHOLD,
      suggestedThreshold - CALIBRATION_CONSTANTS.MAX_ADJUSTMENT * 0.33
    );
  }
  if (negativeFeedback > 20 && accuracy < 0.7) {
    // High negative feedback
    suggestedThreshold = Math.min(
      CALIBRATION_CONSTANTS.MAX_SUGGESTED_THRESHOLD,
      suggestedThreshold + CALIBRATION_CONSTANTS.MAX_ADJUSTMENT * 0.5
    );
  }

  // Ensure bounds
  suggestedThreshold = Math.max(
    CALIBRATION_CONSTANTS.MIN_SUGGESTED_THRESHOLD,
    Math.min(CALIBRATION_CONSTANTS.MAX_SUGGESTED_THRESHOLD, suggestedThreshold)
  );

  // Auto threshold is generally fixed but can be slightly adjusted
  if (accuracy > 0.95 && confirmed >= 15) {
    autoThreshold = Math.max(CALIBRATION_CONSTANTS.MIN_AUTO_THRESHOLD, 0.88);
  }

  // High confidence threshold is between suggested and auto
  const highConfidenceThreshold = suggestedThreshold + (autoThreshold - suggestedThreshold) * 0.4;

  return {
    suggestedThreshold: Math.round(suggestedThreshold * 1000) / 1000,
    autoThreshold: Math.round(autoThreshold * 1000) / 1000,
    highConfidenceThreshold: Math.round(highConfidenceThreshold * 1000) / 1000,
  };
}

function getDefaultCalibration(tenantId: string): TenantCalibration {
  return {
    tenantId,
    calibratedSuggestedThreshold: CALIBRATION_CONSTANTS.DEFAULT_SUGGESTED_THRESHOLD,
    calibratedAutoThreshold: CALIBRATION_CONSTANTS.DEFAULT_AUTO_THRESHOLD,
    calibratedHighConfidenceThreshold: CALIBRATION_CONSTANTS.DEFAULT_HIGH_CONFIDENCE_THRESHOLD,
    totalSuggestions: 0,
    confirmedSuggestions: 0,
    declinedSuggestions: 0,
    unmatchedSuggestions: 0,
    suggestedMatchAccuracy: 0,
    avgConfidenceConfirmed: null,
    avgConfidenceDeclined: null,
    avgConfidenceUnmatched: null,
    lastCalibratedAt: new Date().toISOString(),
  };
}

// ==============================================
// EXPORTS
// ==============================================

export default {
  getCalibration,
  updateCalibration,
  resetCalibration,
  CALIBRATION_CONSTANTS,
};
