/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CHAT_PERSONA_AND_UI_FORMATTING } from './chatPersona';
import { FORMATTING_PROTOCOL } from './formattingProtocol';
import { PREAMBLE } from './preamble';
import { TOOLS_OVERVIEW } from './tools';

// =================================================================================================
// MASTER PROMPT: CORE DIRECTIVES FOR THE AI
// =================================================================================================

export const systemInstruction = `
${PREAMBLE}

================================================================================

${TOOLS_OVERVIEW}

================================================================================

${FORMATTING_PROTOCOL}

================================================================================

${CHAT_PERSONA_AND_UI_FORMATTING}
`;
