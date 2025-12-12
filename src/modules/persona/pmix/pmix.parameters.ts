/**
 * Prompt Mixer Parameter Registry
 *
 * This module provides a type-safe parameter management system for prompt variables.
 * It handles variable definitions, dependencies, and runtime replacements while
 * maintaining strict type safety throughout the application.
 *
 * Key concepts:
 * - Variables are categorized by their scope/type
 * - Each variable has a clear definition of its dependencies and replacement logic
 * - The system is extensible for future object-variable replacement
 */

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { findLLMOrThrow } from '~/common/stores/llms/store-llms';


/// Types

interface PVariableDefinition {

  scope: 'global' | 'system' | 'model' | 'user';
  description: string;

  dependencies?: {
    assistantLlmId?: boolean;     // requires the LLM ID
    lowHourPrecision?: boolean;   // affects behavior with time
  };

  // replacement behavior
  wholeLine?: boolean;            // whether to remove the whole line if variable is undefined
  pattern?: RegExp;               // for variables that need regex replacement (e.g., {{LLM.LowRL:...}})

  // function to generate the replacement text
  replace: (context: PPromptMixerContext) => string | null;
}

export interface PPromptMixerContext {
  assistantLlmId?: DLLMId;
  deviceIsDesktop?: boolean;
  deviceBrowserLang?: string;
  lowHourPrecision?: boolean;
  fixupAutoSuggestHTMLUI?: boolean;
  customFields?: Record<string, string>;
}

export type PPromptVariable = keyof typeof PromptVariableRegistry;


// Registry

export const PromptVariableRegistry: Record<string, PVariableDefinition> = {

  // ============================================
  // Date and Time
  // ============================================

  '{{Today}}': {
    scope: 'global',
    description: 'Current date in YYYY-MM-DD format',
    replace: () => {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    },
  },

  // {{LocaleNow}} - enough information to get on the same page with the user
  '{{LocaleNow}}': {
    scope: 'global',
    description: 'Locale-aware date and time',
    dependencies: { lowHourPrecision: true },
    replace: ({ lowHourPrecision, deviceBrowserLang }) => {
      const formatter = new Intl.DateTimeFormat(deviceBrowserLang, {
        weekday: 'short', // Full name of the day of the week
        year: 'numeric', // Numeric year
        month: 'short', // Full name of the month
        day: 'numeric', // Numeric day of the month
        hour: '2-digit', // 2-digit hour
        // NOTE: disable the minutes if we are using auto-breakpoints, as this will invalidate all every minute...
        minute: lowHourPrecision ? undefined : '2-digit', // 2-digit minute
        timeZoneName: 'short', // Short timezone name (e.g., GMT, CST)
        hour12: true, // Use 12-hour time format; set to false for 24-hour format if preferred
      });
      return formatter.format(new Date());
    },
  },

  // ============================================
  // Rendering Capabilities
  // ============================================

  '{{PreferTables}}': {
    scope: 'system',
    description: 'Instruct to prefer tabulated data',
    replace: () => 'Data presentation: prefer tables (auto-columns)',
  },

  '{{RenderMermaid}}': {
    scope: 'system',
    description: 'Enable Mermaid diagram rendering',
    replace: () => 'Mermaid rendering: Enabled for diagrams and pie charts and no other charts',
  },

  '{{RenderPlantUML}}': {
    scope: 'system',
    description: 'Enable PlantUML diagram rendering',
    replace: () => 'PlantUML rendering: Enabled',
  },

  '{{RenderSVG}}': {
    scope: 'system',
    description: 'Enable SVG rendering',
    replace: () => 'SVG in markdown rendering: Enabled',
  },

  '{{RenderHTML}}': {
    scope: 'system',
    description: 'Enable HTML rendering with device awareness',
    replace: ({ deviceIsDesktop }) =>
      `HTML in markdown rendering: Sleek HTML5 for ${deviceIsDesktop ? 'desktop' : 'mobile'} screens (self-contained with CSS/JS, leverage top libraries, external links OK)`,
  },

  '{{RenderChartJS}}': {
    scope: 'system',
    description: 'Enable ChartJS chart rendering',
    replace: () => `
When presenting data that would be better visualized as a chart, output a ChartJS configuration JSON in this format:
\`\`\`chartjs
{
  // Valid and complete ChartJS configuration JSON (DO NOT USE FUNCTIONS)
}
\`\`\`
Choose the most suitable chart type based on the data and context. Include only the JSON configuration, without any explanatory text. Ensure the JSON is valid and complete and can be parsed by ChartJS.
`.trim(),
  },

  // ============================================
  // Model Capabilities
  // ============================================

  '{{LLM.Cutoff}}': {
    scope: 'model',
    description: 'Model knowledge cutoff date',
    dependencies: { assistantLlmId: true },
    wholeLine: true,
    replace: ({ assistantLlmId }) => {
      try {
        if (assistantLlmId)
          return findLLMOrThrow(assistantLlmId).trainingDataCutoff || null;
      } catch (e) {
        // ignore...
      }
      return null;
    },
  },

  '{{LLM.LowRL:...}}': {
    scope: 'model',
    description: 'Conditional content for non-reasoning models',
    dependencies: { assistantLlmId: true },
    pattern: /{{LLM\.LowRL:(.*?)}}/gs,
    replace: ({ assistantLlmId }) => {
      const removeLineForDLLMIDs = [
        '-claude-3-5', '-claude-3-opus',    // [Anthropic]
        '-deepseek-chat',                   // [DeepSeek]
        '-gemini-1.5',                      // [Google]
        '-mistral-large',                   // [Mistral]
        '-o1', '-gpt-4o', '-gpt-4-turbo',   // [OpenAI]
      ];
      const shallRemoveLine = !assistantLlmId ? false : removeLineForDLLMIDs.some(model => assistantLlmId.includes(model));
      return shallRemoveLine ? null : '$1';
    },
  },

  // ============================================
  // User Profile - Basic Information
  // ============================================

  '{{user_name}}': {
    scope: 'user',
    description: 'User\'s display name',
    replace: () => 'Jose Angel',
  },

  '{{user_age}}': {
    scope: 'user',
    description: 'User\'s age in years',
    replace: () => '30',
  },

  // ============================================
  // User Profile - Body Composition
  // ============================================

  '{{weight}}': {
    scope: 'user',
    description: 'User\'s body weight in lbs',
    replace: () => '212',
  },

  '{{body_fat_percentage}}': {
    scope: 'user',
    description: 'User\'s body fat percentage',
    replace: () => '24',
  },

  '{{muscle_mass}}': {
    scope: 'user',
    description: 'User\'s lean body mass in lbs',
    replace: () => '161',
  },

  '{{bmr}}': {
    scope: 'user',
    description: 'User\'s basal metabolic rate in calories',
    replace: () => '1949',
  },

  // ============================================
  // User Profile - Fitness Level & Goals
  // ============================================

  '{{user_fitness_level}}': {
    scope: 'user',
    description: 'User\'s current fitness level and VO2max',
    replace: () => 'Intermediate to Advanced with VO2max of 47 ml/kg/min (Good-Excellent range)',
  },

  '{{user_goals}}': {
    scope: 'user',
    description: 'User\'s weekly training goals and primary focus',
    replace: () => 'weekly goal of 20m Heart Rate zone 4-5, 3h 20m zone 1-3 cardio, 3hr strength training. Primary focus: build strength while improving cardiovascular base',
  },

  // ============================================
  // User Profile - Training Preferences
  // ============================================

  '{{user_workout_duration}}': {
    scope: 'user',
    description: 'Typical workout session duration',
    replace: () => '60-90 minutes per strength session, 20-60 minutes cardio sessions',
  },

  '{{user_workout_type}}': {
    scope: 'user',
    description: 'User\'s training program structure',
    replace: () => 'Push/Pull/Legs strength split with Zone 2 cardio base and Zone 4-5 intervals',
  },

  '{{user_target_muscles}}': {
    scope: 'user',
    description: 'Target movement patterns and muscle groups',
    replace: () => 'All major movement patterns: horizontal push/pull, vertical push/pull, hip hinge, squat, loaded carry',
  },

  // ============================================
  // User Profile - Equipment Access
  // ============================================

  '{{user_gym_equipment}}': {
    scope: 'user',
    description: 'Available gym equipment for the user',
    replace: () => 'Commercial Gym (full equipment): Barbells, Dumbbells, Smith Machine, Kettlebells, Cable Machines, Lat Pulldown Machine, Seated Row Machine, Leg Press Machine, Leg Extension Machine, Leg Curl Machine, Chest Press Machine, Incline Bench, Flat Bench, Adjustable Bench, Squat Rack, Power Rack, Pull-Up Bar, Dip Station, Stairmaster, Treadmill, Stationary Bike (available but not preferred), Medicine Balls, Resistance Bands, Calf Raise Machine, Hack Squat Machine. Home Gym also available.',
  },

} as const;


// ============================================
// Helper Functions
// ============================================

/**
 * Get all variables for a specific scope
 */
export function getVariablesByScope(scope: PVariableDefinition['scope']): string[] {
  return Object.entries(PromptVariableRegistry)
    .filter(([_, def]) => def.scope === scope)
    .map(([key]) => key);
}

/**
 * Get all user profile variables
 */
export function getUserProfileVariables(): string[] {
  return getVariablesByScope('user');
}

/**
 * Check if a variable exists in the registry
 */
export function isRegisteredVariable(variable: string): boolean {
  return variable in PromptVariableRegistry;
}
