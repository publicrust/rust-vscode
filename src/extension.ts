import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parseHook, ParsedHook } from './parser';
import { generateSnippets, saveSnippets, registerSnippetProvider, Snippets } from './snippets';

let diagnosticCollection: vscode.DiagnosticCollection;
let outputChannel: vscode.OutputChannel;
let extensionPath: string;
let validHookDecoration: vscode.TextEditorDecorationType;
let snippets: Snippets;
let extensionContext: vscode.ExtensionContext;

interface DeprecatedHooks {
    [key: string]: string;
}

function loadDeprecatedHooks(): DeprecatedHooks {
    try {
        const vscodePath = getVscodePath();
        if (vscodePath) {
            const deprecatedPath = path.join(vscodePath, 'deprecated-hooks.json');
            if (fs.existsSync(deprecatedPath)) {
                const content = fs.readFileSync(deprecatedPath, 'utf8');
                const parsed = JSON.parse(content);
                return parsed.deprecated || {};
            }
        }
        
        // Fall back to extension's deprecated hooks file
        const defaultDeprecatedPath = path.join(extensionContext.extensionPath, 'deprecated-hooks.json');
        const content = fs.readFileSync(defaultDeprecatedPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        outputChannel.appendLine(`Error loading deprecated hooks: ${error}`);
        return {};
    }
}

function loadValidHooks(): string[] {
    try {
        const vscodePath = getVscodePath();
        if (vscodePath) {
            const hooksPath = path.join(vscodePath, 'rust-hooks.json');
            if (fs.existsSync(hooksPath)) {
                const content = fs.readFileSync(hooksPath, 'utf8');
                const parsed = JSON.parse(content);
                return parsed.hooks || [];
            }
        }
        
        // Fall back to extension's default hooks
        const defaultHooksPath = path.join(extensionContext.extensionPath, 'hooks.json');
        const content = fs.readFileSync(defaultHooksPath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        outputChannel.appendLine(`Error loading valid hooks: ${error}`);
        return [];
    }
}

function createRegexFromHook(hook: string, checkMissingParams: boolean = false): RegExp {
    const parsedHook = parseHook(hook);
    const escapedName = parsedHook.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const methodStart = 'void\\s+' + escapedName + '\\s*\\(';
    
    if (checkMissingParams) {
        return new RegExp(methodStart + '([^)]*)\\)', 'g');
    }
    
    if (parsedHook.parameters.length > 0) {
        const paramPattern = parsedHook.parameters
            .map(param => {
                const type = param.split(' ')[0];
                return type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+\\w+';
            })
            .join('\\s*,\\s*');
        return new RegExp(methodStart + '\\s*' + paramPattern + '\\s*\\)', 'g');
    }
    
    return new RegExp(methodStart + '\\s*\\)', 'g');
}

function analyzeDocument(document: vscode.TextDocument) {
    if (document.languageId !== 'csharp') {
        return;
    }

    outputChannel.appendLine(`\nAnalyzing document: ${document.fileName}`);
    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];
    const deprecatedHooks = loadDeprecatedHooks();
    const validHooks = loadValidHooks();
    const validHookRanges: vscode.Range[] = [];

    // Process deprecated hooks
    for (const [oldHook, newHook] of Object.entries(deprecatedHooks)) {
        const regex = createRegexFromHook(oldHook);
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);
            
            const diagnostic = new vscode.Diagnostic(
                range,
                `Hook "${oldHook}" is deprecated.\n${newHook ? `Use "${newHook}" instead.` : 'No direct replacement available.'}`,
                vscode.DiagnosticSeverity.Error
            );
            
            diagnostic.source = 'Rust Hook Analyzer';
            diagnostics.push(diagnostic);
        }
    }

    // Process valid hooks and missing parameters
    for (const hook of validHooks) {
        const parsedHook = parseHook(hook);
        const regex = createRegexFromHook(hook, true);
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);
            
            const params = match[1].trim();
            const paramCount = params ? params.split(',').length : 0;
            
            if (paramCount < parsedHook.parameters.length) {
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `Hook "${parsedHook.name}" has missing parameters.\nExpected: ${hook}`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'Rust Hook Analyzer';
                diagnostics.push(diagnostic);
            }
            
            validHookRanges.push(range);
        }
    }

    // Apply decorations to valid hooks
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document === document) {
        activeEditor.setDecorations(validHookDecoration, validHookRanges);
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    extensionPath = context.extensionPath;
    console.log('Extension is now active!');
    
    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Rust Hook Analyzer');
    outputChannel.show();
    outputChannel.appendLine('Extension activated');

    // Create decoration type for valid hooks
    validHookDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 0, 0.2)',
        border: '1px solid rgba(0, 255, 0, 0.3)'
    });

    diagnosticCollection = vscode.languages.createDiagnosticCollection('deprecated-hooks');
    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(validHookDecoration);

    // Ensure .vscode directory exists
    ensureVscodeDirectory();

    // Generate and register snippets
    const validHooks = loadValidHooks();
    snippets = generateSnippets(validHooks);
    saveSnippets(snippets, extensionPath, outputChannel);
    registerSnippetProvider(context, snippets);

    // Register the command to analyze the current file
    let disposable = vscode.commands.registerCommand('extension.analyzeDeprecatedHooks', () => {
        outputChannel.appendLine('Manual analysis triggered');
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            analyzeDocument(activeEditor.document);
        }
    });

    context.subscriptions.push(disposable);

    // Register document events
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument((document) => {
            outputChannel.appendLine(`Document opened: ${document.fileName}`);
            analyzeDocument(document);
        }),
        vscode.workspace.onDidChangeTextDocument(event => {
            // outputChannel.appendLine(`Document changed: ${event.document.fileName}`);
            analyzeDocument(event.document);
        }),
        vscode.workspace.onDidSaveTextDocument(document => {
            outputChannel.appendLine(`Document saved: ${document.fileName}`);
            analyzeDocument(document);
        })
    );

    // Analyze all open documents
    vscode.workspace.textDocuments.forEach(analyzeDocument);
}

function ensureVscodeDirectory(): void {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        outputChannel.appendLine('No workspace folder found');
        return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const vscodePath = path.join(workspaceRoot, '.vscode');
    
    if (!fs.existsSync(vscodePath)) {
        try {
            fs.mkdirSync(vscodePath);
            outputChannel.appendLine('Created .vscode directory');
        } catch (error) {
            outputChannel.appendLine(`Error creating .vscode directory: ${error}`);
            return;
        }
    }

    initializeWorkspaceFiles(vscodePath);
}

function initializeWorkspaceFiles(vscodePath: string): void {
    const extensionPath = extensionContext.extensionPath;

    try {
        // Read the source hooks file
        const hooksPath = path.join(extensionPath, 'hooks.json');
        const hooksContent = fs.readFileSync(hooksPath, 'utf8');
        const hooks = JSON.parse(hooksContent);

        // Create rust-hooks.json with all valid hooks
        const rustHooksPath = path.join(vscodePath, 'rust-hooks.json');
        if (!fs.existsSync(rustHooksPath)) {
            const validHooks = {
                hooks: hooks
            };
            fs.writeFileSync(rustHooksPath, JSON.stringify(validHooks, null, 2));
            outputChannel.appendLine('Created rust-hooks.json with all hooks');
        }

        // Copy deprecated hooks from project's deprecated-hooks.json
        const projectDeprecatedPath = path.join(extensionPath, 'deprecated-hooks.json');
        const deprecatedPath = path.join(vscodePath, 'deprecated-hooks.json');
        if (!fs.existsSync(deprecatedPath)) {
            try {
                const deprecatedContent = fs.readFileSync(projectDeprecatedPath, 'utf8');
                const deprecatedHooks = {
                    deprecated: JSON.parse(deprecatedContent)
                };
                fs.writeFileSync(deprecatedPath, JSON.stringify(deprecatedHooks, null, 2));
                outputChannel.appendLine('Created deprecated-hooks.json from project template');
            } catch (error) {
                outputChannel.appendLine(`Error copying deprecated hooks: ${error}`);
            }
        }

        // Copy styles if they exist
        const stylesPath = path.join(extensionPath, 'styles.json');
        const hookStylesPath = path.join(vscodePath, 'hook-styles.json');
        if (fs.existsSync(stylesPath) && !fs.existsSync(hookStylesPath)) {
            fs.copyFileSync(stylesPath, hookStylesPath);
            outputChannel.appendLine('Created hook-styles.json');
        }

        // Create settings file
        const settingsPath = path.join(vscodePath, 'hook-settings.json');
        if (!fs.existsSync(settingsPath)) {
            const defaultSettings = {
                enableWarnings: true,
                highlightValidHooks: true,
                showDeprecationWarnings: true,
                customHooksEnabled: false
            };
            fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
            outputChannel.appendLine('Created hook-settings.json');
        }
    } catch (error) {
        outputChannel.appendLine(`Error initializing workspace files: ${error}`);
    }
}

function getVscodePath(): string | undefined {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        return undefined;
    }
    return path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.vscode');
}

export function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
    if (validHookDecoration) {
        validHookDecoration.dispose();
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
}