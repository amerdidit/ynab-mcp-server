import * as fs from "fs";
import * as path from "path";
import * as os from "os";
/**
 * Get the base cache directory (~/.ynab-mcp/cache/)
 */
function getBaseCacheDir() {
    return path.join(os.homedir(), ".ynab-mcp", "cache");
}
/**
 * Get the cache directory for a specific budget
 * Creates the directory if it doesn't exist
 */
export function getCacheDir(budgetId) {
    const cacheDir = path.join(getBaseCacheDir(), budgetId);
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
}
/**
 * Read a JSON cache file
 * Returns undefined if the file doesn't exist or is invalid
 */
export function readCache(budgetId, filename) {
    try {
        const filePath = path.join(getCacheDir(budgetId), filename);
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        const content = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch (error) {
        console.error(`Error reading cache file ${filename}:`, error);
        return undefined;
    }
}
/**
 * Write a JSON cache file
 */
export function writeCache(budgetId, filename, data) {
    const filePath = path.join(getCacheDir(budgetId), filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
/**
 * Delete a cache file
 */
export function deleteCache(budgetId, filename) {
    try {
        const filePath = path.join(getCacheDir(budgetId), filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    }
    catch (error) {
        console.error(`Error deleting cache file ${filename}:`, error);
        return false;
    }
}
/**
 * Clear all cache for a budget
 */
export function clearBudgetCache(budgetId) {
    const cacheDir = path.join(getBaseCacheDir(), budgetId);
    if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true });
    }
}
