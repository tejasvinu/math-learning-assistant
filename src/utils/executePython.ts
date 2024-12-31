import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

const execAsync = promisify(exec);

// Whitelist of allowed Python modules for mathematical operations
const ALLOWED_MODULES = new Set([
    'math', 'numpy', 'statistics', 'random',
    'decimal', 'fractions', 'operator'
]);

function validatePythonCode(code: string): boolean {
    // Check for import statements
    const importMatches = code.match(/import\s+([a-zA-Z0-9_,\s]+)/g) || [];
    for (const match of importMatches) {
        const modules = match.replace('import', '').trim().split(',');
        for (const module of modules) {
            if (!ALLOWED_MODULES.has(module.trim())) {
                return false;
            }
        }
    }
    
    // Check for potentially harmful operations
    const blacklist = [
        'open', 'file', 'exec', 'eval', 'subprocess',
        'os.', 'sys.', '__import__', 'input('
    ];
    
    return !blacklist.some(term => code.includes(term));
}

export async function executePythonCode(code: string): Promise<{ output?: string; error?: string }> {
    if (!validatePythonCode(code)) {
        return { error: 'Invalid or unauthorized Python code' };
    }

    const tempFileName = join(tmpdir(), `python-${crypto.randomBytes(6).toString('hex')}.py`);
    
    try {
        // Write code to temporary file
        await writeFile(tempFileName, code, 'utf-8');
        
        // Execute with proper encoding and error handling
        const { stdout, stderr } = await execAsync(`python "${tempFileName}"`, {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024, // 1MB buffer
            timeout: 5000 // 5 second timeout
        });

        if (stderr) {
            return { error: stderr };
        }

        return { output: stdout.trim() };
    } catch (error: any) {
        return { 
            error: error.message.includes('ETIMEDOUT') 
                ? 'Execution timed out' 
                : error.message 
        };
    } finally {
        // Cleanup: Delete temporary file
        try {
            await unlink(tempFileName);
        } catch (e) {
            console.error('Failed to cleanup temporary file:', e);
        }
    }
}