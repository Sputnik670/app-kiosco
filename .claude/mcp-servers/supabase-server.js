#!/usr/bin/env node

/**
 * Servidor MCP para Supabase
 * Este servidor permite interactuar con Supabase a través del Model Context Protocol
 */

// Cargar variables de entorno desde .env
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// Configuración de Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY deben estar configuradas');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Crear servidor MCP
const server = new Server(
  {
    name: 'supabase-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Definir herramientas disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'query_table',
        description: 'Consultar datos de una tabla en Supabase. Retorna las filas que coincidan con los filtros.',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla a consultar',
            },
            columns: {
              type: 'string',
              description: 'Columnas a seleccionar (ej: "*" o "id,nombre,email")',
              default: '*',
            },
            filters: {
              type: 'object',
              description: 'Filtros a aplicar (ej: {"status": "active"})',
              default: {},
            },
            limit: {
              type: 'number',
              description: 'Límite de registros a retornar',
              default: 100,
            },
          },
          required: ['table'],
        },
      },
      {
        name: 'insert_row',
        description: 'Insertar un nuevo registro en una tabla de Supabase',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla',
            },
            data: {
              type: 'object',
              description: 'Datos a insertar',
            },
          },
          required: ['table', 'data'],
        },
      },
      {
        name: 'update_row',
        description: 'Actualizar registros en una tabla de Supabase',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla',
            },
            filters: {
              type: 'object',
              description: 'Filtros para identificar los registros a actualizar',
            },
            data: {
              type: 'object',
              description: 'Datos a actualizar',
            },
          },
          required: ['table', 'filters', 'data'],
        },
      },
      {
        name: 'delete_row',
        description: 'Eliminar registros de una tabla de Supabase',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla',
            },
            filters: {
              type: 'object',
              description: 'Filtros para identificar los registros a eliminar',
            },
          },
          required: ['table', 'filters'],
        },
      },
      {
        name: 'execute_rpc',
        description: 'Ejecutar una función RPC (procedimiento almacenado) en Supabase',
        inputSchema: {
          type: 'object',
          properties: {
            function_name: {
              type: 'string',
              description: 'Nombre de la función RPC',
            },
            params: {
              type: 'object',
              description: 'Parámetros de la función',
              default: {},
            },
          },
          required: ['function_name'],
        },
      },
      {
        name: 'list_tables',
        description: 'Listar todas las tablas disponibles en la base de datos',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_table_schema',
        description: 'Obtener el esquema de una tabla específica',
        inputSchema: {
          type: 'object',
          properties: {
            table: {
              type: 'string',
              description: 'Nombre de la tabla',
            },
          },
          required: ['table'],
        },
      },
    ],
  };
});

// Manejar llamadas a herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'query_table': {
        const { table, columns = '*', filters = {}, limit = 100 } = args;
        let query = supabase.from(table).select(columns).limit(limit);

        // Aplicar filtros
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }

        const { data, error } = await query;

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'insert_row': {
        const { table, data } = args;
        const { data: result, error } = await supabase
          .from(table)
          .insert(data)
          .select();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Registro insertado exitosamente:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'update_row': {
        const { table, filters, data } = args;
        let query = supabase.from(table).update(data);

        // Aplicar filtros
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }

        const { data: result, error } = await query.select();

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: `Registros actualizados:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case 'delete_row': {
        const { table, filters } = args;
        let query = supabase.from(table).delete();

        // Aplicar filtros
        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }

        const { error } = await query;

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: 'Registros eliminados exitosamente',
            },
          ],
        };
      }

      case 'execute_rpc': {
        const { function_name, params = {} } = args;
        const { data, error } = await supabase.rpc(function_name, params);

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'list_tables': {
        const { data, error } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public');

        if (error) {
          // Fallback: intentar listar tablas conocidas del proyecto
          return {
            content: [
              {
                type: 'text',
                text: 'Nota: No se pudo acceder a information_schema. Consulta las tablas directamente usando query_table.',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case 'get_table_schema': {
        const { table } = args;
        const { data, error } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable')
          .eq('table_name', table)
          .eq('table_schema', 'public');

        if (error) throw error;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Herramienta desconocida: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Servidor MCP de Supabase iniciado');
}

main().catch((error) => {
  console.error('Error fatal:', error);
  process.exit(1);
});
