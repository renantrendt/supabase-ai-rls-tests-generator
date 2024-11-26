"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseAITester = void 0;
var supabase_js_1 = require("@supabase/supabase-js");
var sdk_1 = require("@anthropic-ai/sdk");
var fs_1 = require("fs");
var path_1 = require("path");
var SupabaseAITester = /** @class */ (function () {
    function SupabaseAITester(_a) {
        var supabaseUrl = _a.supabaseUrl, supabaseKey = _a.supabaseKey, claudeKey = _a.claudeKey, _b = _a.config, config = _b === void 0 ? {} : _b;
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
        this.claude = new sdk_1.default({ apiKey: claudeKey });
        this.config = __assign({ testTimeout: 5000, retryAttempts: 3, verbose: true }, config);
    }
    SupabaseAITester.prototype.runRLSTests = function (tableName) {
        return __awaiter(this, void 0, void 0, function () {
            var policies, testCases, results, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        console.log('Starting RLS tests for table:', tableName);
                        return [4 /*yield*/, this.getRLSPolicies(tableName)];
                    case 1:
                        policies = _a.sent();
                        return [4 /*yield*/, this.generateTestCases(policies)];
                    case 2:
                        testCases = _a.sent();
                        // Save generated tests
                        return [4 /*yield*/, this.saveTestCases(testCases)];
                    case 3:
                        // Save generated tests
                        _a.sent();
                        return [4 /*yield*/, this.executeTests(testCases)];
                    case 4:
                        results = _a.sent();
                        // Save test results
                        return [4 /*yield*/, this.saveResults(results)];
                    case 5:
                        // Save test results
                        _a.sent();
                        return [2 /*return*/, this.generateReport(results)];
                    case 6:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Unknown error';
                        throw new Error("RLS Test failed: ".concat(errorMessage));
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    SupabaseAITester.prototype.getRLSPolicies = function (tableName) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, data, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        console.log('Fetching policies for table:', tableName);
                        return [4 /*yield*/, this.supabase
                                .rpc('get_policies', { target_table: tableName })];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            throw new Error("Failed to get RLS policies: ".concat(error.message));
                        }
                        console.log('Received policies:', data);
                        return [2 /*return*/, data];
                }
            });
        });
    };
    SupabaseAITester.prototype.generateTestCases = function (policies) {
        return __awaiter(this, void 0, void 0, function () {
            var message, content, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.claude.messages.create({
                                model: "claude-3-sonnet-20240229",
                                max_tokens: 1000,
                                messages: [{
                                        role: "user",
                                        content: "Generate test cases for these Supabase RLS policies:\n            ".concat(JSON.stringify(policies, null, 2), "\n            \n            Table structure:\n            - id: UUID (auto-generated)\n            - user_id: UUID (required)\n            - title: TEXT (required)\n            - content: TEXT (optional)\n            \n            Return a JSON array where each test case has this structure:\n            {\n              \"name\": \"string\",\n              \"description\": \"string\",\n              \"method\": \"select\" | \"insert\" | \"update\" | \"delete\",\n              \"path\": \"posts\",\n              \"body\": { \n                \"user_id\": \"uuid-string\",  // Example: \"123e4567-e89b-12d3-a456-426614174000\"\n                \"title\": \"string\",         // Required field\n                \"content\": \"string\"        // Optional field\n              },\n              \"expectedStatus\": number\n            }\n            \n            Important:\n            - user_id must be in UUID format\n            - title is required\n            - Use consistent UUIDs across related tests\n            \n            Return only the JSON array.")
                                    }]
                            })];
                    case 1:
                        message = _a.sent();
                        content = message.content[0].text;
                        if (!content) {
                            throw new Error('Claude response was empty');
                        }
                        return [2 /*return*/, this.parseAIResponse(content)];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Error generating test cases:', error_2);
                        throw new Error("AI test generation failed: ".concat(error_2 instanceof Error ? error_2.message : 'Unknown error'));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SupabaseAITester.prototype.parseAIResponse = function (content) {
        try {
            console.log('Parsing AI response...');
            // Remove any markdown formatting or extra text
            var jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }
            var jsonString = jsonMatch[0];
            console.log('Cleaned JSON string:', jsonString);
            var parsed = JSON.parse(jsonString);
            if (!Array.isArray(parsed)) {
                throw new Error('Response is not an array');
            }
            var testCases = parsed.map(function (test) { return ({
                method: test.method.toLowerCase(),
                path: test.path,
                description: test.description,
                body: test.body,
                expectedStatus: test.expectedStatus
            }); });
            console.log('Parsed test cases:', testCases);
            return testCases;
        }
        catch (error) {
            console.error('Parse error:', error);
            throw new Error("Failed to parse AI response: ".concat(error instanceof Error ? error.message : 'Unknown error'));
        }
    };
    SupabaseAITester.prototype.withTimeout = function (promise, timeoutMs) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Promise.race([
                        promise(),
                        new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error('Test timeout')); }, timeoutMs);
                        })
                    ])];
            });
        });
    };
    SupabaseAITester.prototype.saveTestCases = function (testCases) {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, filePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        filePath = path_1.default.join('generated', 'tests', "test-cases-".concat(timestamp, ".json"));
                        return [4 /*yield*/, fs_1.default.promises.writeFile(filePath, JSON.stringify(testCases, null, 2))];
                    case 1:
                        _a.sent();
                        console.log("Test cases saved to: ".concat(filePath));
                        return [2 /*return*/];
                }
            });
        });
    };
    SupabaseAITester.prototype.saveResults = function (results) {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, filePath, summary;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                        filePath = path_1.default.join('generated', 'results', "test-results-".concat(timestamp, ".json"));
                        summary = {
                            timestamp: timestamp,
                            total: results.length,
                            passed: results.filter(function (r) { return r.success; }).length,
                            failed: results.filter(function (r) { return !r.success; }).length,
                            details: results
                        };
                        return [4 /*yield*/, fs_1.default.promises.writeFile(filePath, JSON.stringify(summary, null, 2))];
                    case 1:
                        _a.sent();
                        console.log("Test results saved to: ".concat(filePath));
                        return [2 /*return*/];
                }
            });
        });
    };
    SupabaseAITester.prototype.executeTests = function (testCases) {
        return __awaiter(this, void 0, void 0, function () {
            var results, _i, testCases_1, test, attempts, success, error, result, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        results = [];
                        _i = 0, testCases_1 = testCases;
                        _a.label = 1;
                    case 1:
                        if (!(_i < testCases_1.length)) return [3 /*break*/, 9];
                        test = testCases_1[_i];
                        attempts = 0;
                        success = false;
                        error = null;
                        _a.label = 2;
                    case 2:
                        if (!(attempts < this.config.retryAttempts && !success)) return [3 /*break*/, 7];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.runSingleTest(test)];
                    case 4:
                        result = _a.sent();
                        success = true;
                        results.push(result);
                        return [3 /*break*/, 6];
                    case 5:
                        e_1 = _a.sent();
                        error = e_1;
                        attempts++;
                        return [3 /*break*/, 6];
                    case 6: return [3 /*break*/, 2];
                    case 7:
                        if (!success) {
                            results.push({
                                test: test,
                                success: false,
                                actual: 500,
                                expected: test.expectedStatus,
                                error: error instanceof Error ? error.message : 'Unknown error'
                            });
                        }
                        _a.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 1];
                    case 9: return [2 /*return*/, results];
                }
            });
        });
    };
    SupabaseAITester.prototype.runSingleTest = function (test) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.withTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                        var method, path, body, queryParams, headers, query, response, _a, data, error, status;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    method = test.method, path = test.path, body = test.body, queryParams = test.queryParams, headers = test.headers;
                                    query = this.supabase.from(path);
                                    if (queryParams) {
                                        Object.entries(queryParams).forEach(function (_a) {
                                            var key = _a[0], value = _a[1];
                                            query = query.eq(key, value);
                                        });
                                    }
                                    _a = method;
                                    switch (_a) {
                                        case 'select': return [3 /*break*/, 1];
                                        case 'insert': return [3 /*break*/, 3];
                                        case 'update': return [3 /*break*/, 5];
                                        case 'delete': return [3 /*break*/, 7];
                                        case 'upsert': return [3 /*break*/, 9];
                                    }
                                    return [3 /*break*/, 11];
                                case 1: return [4 /*yield*/, query.select()];
                                case 2:
                                    response = _b.sent();
                                    return [3 /*break*/, 12];
                                case 3: return [4 /*yield*/, query.insert(body)];
                                case 4:
                                    response = _b.sent();
                                    return [3 /*break*/, 12];
                                case 5: return [4 /*yield*/, query.update(body)];
                                case 6:
                                    response = _b.sent();
                                    return [3 /*break*/, 12];
                                case 7: return [4 /*yield*/, query.delete()];
                                case 8:
                                    response = _b.sent();
                                    return [3 /*break*/, 12];
                                case 9: return [4 /*yield*/, query.upsert(body)];
                                case 10:
                                    response = _b.sent();
                                    return [3 /*break*/, 12];
                                case 11: throw new Error("Unsupported method: ".concat(method));
                                case 12:
                                    data = response.data, error = response.error, status = response.status;
                                    if (error) {
                                        return [2 /*return*/, {
                                                test: test,
                                                success: false,
                                                actual: status || 500,
                                                expected: test.expectedStatus,
                                                error: error.message
                                            }];
                                    }
                                    return [2 /*return*/, {
                                            test: test,
                                            success: status === test.expectedStatus,
                                            actual: status,
                                            expected: test.expectedStatus
                                        }];
                            }
                        });
                    }); }, this.config.testTimeout)];
            });
        });
    };
    SupabaseAITester.prototype.generateReport = function (results) {
        var summary = {
            total: results.length,
            passed: results.filter(function (r) { return r.success; }).length,
            failed: results.filter(function (r) { return !r.success; }).length,
            details: results
        };
        if (this.config.verbose) {
            console.log('Test Report:', JSON.stringify(summary, null, 2));
        }
        return results;
    };
    return SupabaseAITester;
}());
exports.SupabaseAITester = SupabaseAITester;
