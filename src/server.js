#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import fs from "node:fs/promises"


const server = new McpServer({
    name: "Verificador de Contraseñas",
    version: "1.0.0",
    capabilities: {
        tools: {},
        resources: {},
        prompts: {}
    }
});

server.registerTool(
    "verificar-password",
    {
        title: "verificar password",
        description: "Analiza tu password y verifica su calidad",
        inputSchema: z.object({
            password: z.string()
        }),
        outputSchema: z.object({ quality: z.string()})
    },
    async ({password}) => {
        try {
            const calidad = verificarPassword({password});
            return {
                content: [
                    { type: "text", text: `Tu password es de calidad ${calidad}.` }
                ],
                structuredContent: {
                    quality: calidad
                }
            };
        }
        catch (error) {
            return {
                content: [
                    { type: "text", text: `error : ${error?.message ?? String(error)}` }
                ]
            };
        }
    }
)

server.registerResource(
    "tips-para-nombrar-passwords",
    "tips://all",
    {
        description: "Muestra tips de seguridad",
        title: "Tips",
        mimeType: "application/json",
    }, async uri => {
        try {

            const tips = await fs.readFile('src/recursos/tips.json', "utf-8").then(res => JSON.parse(res));

            return {
                contents: [
                    {
                        uri: uri.href,
                        text: JSON.stringify(tips, null, 2),
                        mimeType: "application/json"
                    }
                ]
            };
        } catch (error) {
            return {
                contents: [
                    {
                        uri: uri.href,
                        text: JSON.stringify({ error: error?.message ?? String(error) }),
                        mimeType: "application/json"
                    }
                ]
            };
        }
    }
)

server.registerPrompt(
    "prompt-verificador-password",
    {
        title: "Prompt para solicitar verificación de password",
        description: "Prompt para solicitar verificación de password",
        argsSchema: {
            password: z.string()
        }
    },
    async ({password}) => {
        return [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Analiza la calidad del password "${password}". Sugiere reglas basadas en las guías OWASP.`
                }
            }
        ]
    }
)

function verificarPassword(params) {
    const password = params.password;
    let nivel = 0;

    // Criterio 1: Mínimo 12 caracteres
    if (password.length >= 12) {
        nivel++;
    }

    // Criterio 2: Contiene mayúsculas
    if (/[A-Z]/.test(password)) {
        nivel++;
    }

    // Criterio 3: Contiene minúsculas
    if (/[a-z]/.test(password)) {
        nivel++;
    }

    // Criterio 4: Contiene números
    if (/[0-9]/.test(password)) {
        nivel++;
    }

    // Criterio 5: Contiene caracteres especiales
    if (/[!@#$%^&*]/.test(password)) {
        nivel++;
    }

    // Clasificar por nivel
    if (nivel <= 1) return "débil";
    if (nivel <= 3) return "media";
    return "fuerte";
}

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main();