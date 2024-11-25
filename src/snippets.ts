import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedHook, parseHook } from './parser';

export interface Snippet {
    prefix: string;
    body: string;
    description: string;
}

export interface Snippets {
    [key: string]: Snippet;
}

export function generateSnippets(hooks: string[]): Snippets {
    const snippets: Snippets = {};
    
    for (const hook of hooks) {
        const parsedHook = parseHook(hook);
        const paramsList = parsedHook.parameters.map((param, index) => `${param} param${index + 1}`).join(', ');
        const hookName = parsedHook.name;
        
        snippets[hook] = {
            prefix: hookName,
            body: `void ${hookName}(${paramsList})\n{\n    // Hook logic here\n}`,
            description: `Hook with parameters ${paramsList}`
        };
    }
    
    return snippets;
}

export function saveSnippets(snippets: Snippets, extensionPath: string, outputChannel: vscode.OutputChannel) {
    try {
        const snippetsPath = path.join(extensionPath, 'snippets.json');
        fs.writeFileSync(snippetsPath, JSON.stringify(snippets, null, 2), 'utf8');
        outputChannel.appendLine('Snippets file generated successfully');
    } catch (error) {
        outputChannel.appendLine(`Error saving snippets: ${error}`);
    }
}

export function registerSnippetProvider(context: vscode.ExtensionContext, snippets: Snippets) {
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('csharp', {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const completionItems: vscode.CompletionItem[] = [];
                
                for (const [hook, snippet] of Object.entries(snippets)) {
                    const completionItem = new vscode.CompletionItem(snippet.prefix);
                    completionItem.kind = vscode.CompletionItemKind.Snippet;
                    completionItem.detail = hook;
                    completionItem.documentation = snippet.description;
                    completionItem.insertText = new vscode.SnippetString(snippet.body);
                    
                    completionItems.push(completionItem);
                }
                
                return completionItems;
            }
        })
    );
}
