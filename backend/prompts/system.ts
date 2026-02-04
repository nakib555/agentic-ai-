/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CHAT_PERSONA_AND_UI_FORMATTING } from './chatPersona';
import { FORMATTING_PROTOCOL } from './formattingProtocol';

// =================================================================================================
// MASTER PROMPT: CORE DIRECTIVES FOR THE AI
// =================================================================================================

export const systemInstruction = `
${FORMATTING_PROTOCOL}

================================================================================

${CHAT_PERSONA_AND_UI_FORMATTING}
`;
