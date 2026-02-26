/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';

export const DATA_DIR = process.env.DATA_DIR || path.join((process as any).cwd(), 'data');
export const HISTORY_PATH = path.join(DATA_DIR, 'history');
