import * as runtime from "@prisma/client/runtime/client";
const config = {
    "previewFeatures": [],
    "clientVersion": "7.10.1",
    "engineVersion": "d1b3f377ca835d73fd50954a5e22128b9ebdd6b8",
    "activeProvider": "postgresql",
    "inlineSchema": "generator client {\n  provider = \"prisma-client\"\n  output   = \"../generated/prisma\"\n}\n\ndatasource db {\n  provider = \"postgresql\"\n}\n\nmodel User {\n  id           String   @id @default(uuid()) @db.Uuid\n  email        String   @unique @db.VarChar(254)\n  passwordHash String   @map(\"password_hash\") @db.Text\n  createdAt    DateTime @default(now()) @map(\"created_at\")\n  updatedAt    DateTime @updatedAt @map(\"updated_at\")\n\n  @@map(\"users\")\n}\n",
    "runtimeDataModel": {
        "models": {},
        "enums": {},
        "types": {}
    },
    "parameterizationSchema": {
        "strings": [],
        "graph": ""
    }
};
config.runtimeDataModel = JSON.parse("{\"models\":{\"User\":{\"fields\":[{\"name\":\"id\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"email\",\"kind\":\"scalar\",\"type\":\"String\"},{\"name\":\"passwordHash\",\"kind\":\"scalar\",\"type\":\"String\",\"dbName\":\"password_hash\"},{\"name\":\"createdAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"created_at\"},{\"name\":\"updatedAt\",\"kind\":\"scalar\",\"type\":\"DateTime\",\"dbName\":\"updated_at\"}],\"dbName\":\"users\",\"schema\":null}},\"enums\":{},\"types\":{}}");
config.parameterizationSchema = {
    strings: JSON.parse("[\"where\",\"User.findUnique\",\"User.findUniqueOrThrow\",\"orderBy\",\"cursor\",\"User.findFirst\",\"User.findFirstOrThrow\",\"User.findMany\",\"data\",\"User.createOne\",\"User.createMany\",\"User.createManyAndReturn\",\"User.updateOne\",\"User.updateMany\",\"User.updateManyAndReturn\",\"create\",\"update\",\"User.upsertOne\",\"User.deleteOne\",\"User.deleteMany\",\"having\",\"_count\",\"_min\",\"_max\",\"User.groupBy\",\"User.aggregate\",\"AND\",\"OR\",\"NOT\",\"id\",\"email\",\"passwordHash\",\"createdAt\",\"updatedAt\",\"equals\",\"in\",\"notIn\",\"lt\",\"lte\",\"gt\",\"gte\",\"not\",\"contains\",\"startsWith\",\"endsWith\",\"set\"]"),
    graph: "LQkQCBoAACQAMBsAAAQAEBwAACQAMB0BAAAAAR4BAAAAAR8BACYAISBAACcAISFAACcAIQEAAAABACABAAAAAQAgCBoAACQAMBsAAAQAEBwAACQAMB0BACUAIR4BACYAIR8BACYAISBAACcAISFAACcAIQADAAAABAAgAwAABQAwBAAAAQAgAwAAAAQAIAMAAAUAMAQAAAEAIAMAAAAEACADAAAFADAEAAABACAFHQEAAAABHgEAAAABHwEAAAABIEAAAAABIUAAAAABAQgAAAkAIAUdAQAAAAEeAQAAAAEfAQAAAAEgQAAAAAEhQAAAAAEBCAAACwAwAQgAAAsAMAUdAQAsACEeAQAsACEfAQAsACEgQAAtACEhQAAtACECAAAAAQAgCAAADgAgBR0BACwAIR4BACwAIR8BACwAISBAAC0AISFAAC0AIQIAAAAEACAIAAAQACACAAAABAAgCAAAEAAgAwAAAAEAIA8AAAkAIBAAAA4AIAEAAAABACABAAAABAAgAxUAACkAIBYAACsAIBcAACoAIAgaAAAaADAbAAAXABAcAAAaADAdAQAbACEeAQAcACEfAQAcACEgQAAdACEhQAAdACEDAAAABAAgAwAAFgAwFAAAFwAgAwAAAAQAIAMAAAUAMAQAAAEAIAgaAAAaADAbAAAXABAcAAAaADAdAQAbACEeAQAcACEfAQAcACEgQAAdACEhQAAdACELFQAAHwAgFgAAIgAgFwAAIgAgIgEAAAABIwEAAAAEJAEAAAAEJQEAAAABJgEAAAABJwEAAAABKAEAAAABKQEAIwAhDhUAAB8AIBYAACIAIBcAACIAICIBAAAAASMBAAAABCQBAAAABCUBAAAAASYBAAAAAScBAAAAASgBAAAAASkBACEAISoBAAAAASsBAAAAASwBAAAAAQsVAAAfACAWAAAgACAXAAAgACAiQAAAAAEjQAAAAAQkQAAAAAQlQAAAAAEmQAAAAAEnQAAAAAEoQAAAAAEpQAAeACELFQAAHwAgFgAAIAAgFwAAIAAgIkAAAAABI0AAAAAEJEAAAAAEJUAAAAABJkAAAAABJ0AAAAABKEAAAAABKUAAHgAhCCICAAAAASMCAAAABCQCAAAABCUCAAAAASYCAAAAAScCAAAAASgCAAAAASkCAB8AIQgiQAAAAAEjQAAAAAQkQAAAAAQlQAAAAAEmQAAAAAEnQAAAAAEoQAAAAAEpQAAgACEOFQAAHwAgFgAAIgAgFwAAIgAgIgEAAAABIwEAAAAEJAEAAAAEJQEAAAABJgEAAAABJwEAAAABKAEAAAABKQEAIQAhKgEAAAABKwEAAAABLAEAAAABCyIBAAAAASMBAAAABCQBAAAABCUBAAAAASYBAAAAAScBAAAAASgBAAAAASkBACIAISoBAAAAASsBAAAAASwBAAAAAQsVAAAfACAWAAAiACAXAAAiACAiAQAAAAEjAQAAAAQkAQAAAAQlAQAAAAEmAQAAAAEnAQAAAAEoAQAAAAEpAQAjACEIGgAAJAAwGwAABAAQHAAAJAAwHQEAJQAhHgEAJgAhHwEAJgAhIEAAJwAhIUAAJwAhCCIBAAAAASMBAAAABCQBAAAABCUBAAAAASYBAAAAAScBAAAAASgBAAAAASkBACgAIQsiAQAAAAEjAQAAAAQkAQAAAAQlAQAAAAEmAQAAAAEnAQAAAAEoAQAAAAEpAQAiACEqAQAAAAErAQAAAAEsAQAAAAEIIkAAAAABI0AAAAAEJEAAAAAEJUAAAAABJkAAAAABJ0AAAAABKEAAAAABKUAAIAAhCCIBAAAAASMBAAAABCQBAAAABCUBAAAAASYBAAAAAScBAAAAASgBAAAAASkBACgAIQAAAAEtAQAAAAEBLUAAAAABAAAAAAMVAAYWAAcXAAgAAAADFQAGFgAHFwAIAQIBAgMBBQYBBgcBBwgBCQoBCgwCCw0DDA8BDRECDhIEERMBEhQBExUCGBgFGRkJ"
};
async function decodeBase64AsWasm(wasmBase64) {
    const { Buffer } = await import('node:buffer');
    const wasmArray = Buffer.from(wasmBase64, 'base64');
    return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
    getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
    getQueryCompilerWasmModule: async () => {
        const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
        return await decodeBase64AsWasm(wasm);
    },
    importName: "./query_compiler_fast_bg.js"
};
export function getPrismaClientClass() {
    return runtime.getPrismaClient(config);
}
//# sourceMappingURL=class.js.map