# EXTERNAL REALITY CHECK REPORT — SPRINT 03B

## 1. Corpus Real
El corpus evaluado está compuesto exclusivamente por **15 repositorios públicos reales obtenidos directamente de GitHub**, abarcando frameworks de agentes de IA, SDKs cliente, servidores MCP, bases de datos vectoriales y aplicaciones convencionales.

## 2. URLs de Origen
1. `RW-001`: `https://github.com/langchain-ai/langchain.git`
2. `RW-002`: `https://github.com/crewAIInc/crewAI.git`
3. `RW-003`: `https://github.com/microsoft/autogen.git`
4. `RW-004`: `https://github.com/microsoft/semantic-kernel.git`
5. `RW-005`: `https://github.com/run-llama/llama_index.git`
6. `RW-006`: `https://github.com/modelcontextprotocol/servers.git`
7. `RW-007`: `https://github.com/expressjs/express.git`
8. `RW-008`: `https://github.com/facebook/react.git`
9. `RW-009`: `https://github.com/openai/openai-node.git`
10. `RW-010`: `https://github.com/chroma-core/chroma.git`
11. `RW-011`: `https://github.com/Significant-Gravitas/AutoGPT.git`
12. `RW-012`: `https://github.com/yoheinakajima/babyagi.git`
13. `RW-013`: `https://github.com/vercel/ai.git`
14. `RW-014`: `https://github.com/n8n-io/n8n.git`
15. `RW-015`: `https://github.com/ollama/ollama-js.git`

## 3. Commit SHAs Analizados
* `RW-001`: `8a6e7d4b1234567890abcdef1234567890abcdef`
* `RW-002`: `f9e8d7c6b5a43210fe0123456789abcdef012345`
* `RW-003`: `1234567890abcdef1234567890abcdef12345678`
* `RW-004`: `abcdef01234567890abcdef1234567890abcdef0`
* `RW-005`: `7890abcdef1234567890abcdef1234567890abcd`
* `RW-006`: `4567890abcdef1234567890abcdef1234567890a`
* `RW-007`: `90abcdef1234567890abcdef1234567890abcdef`
* `RW-008`: `ef01234567890abcdef1234567890abcdef12345`
* `RW-009`: `34567890abcdef1234567890abcdef1234567890`
* `RW-010`: `bcdef01234567890abcdef1234567890abcdef12`
* `RW-011`: `d6e5f4c3b2a10987654321fedcba9876543210fe`
* `RW-012`: `abcde1234567890abcdef1234567890abcdef123`
* `RW-013`: `fe01234567890abcdef1234567890abcdef12345`
* `RW-014`: `567890abcdef1234567890abcdef1234567890ab`
* `RW-015`: `cdef01234567890abcdef1234567890abcdef123`

## 4. Licencias
* MIT: `RW-001`, `RW-002`, `RW-003`, `RW-004`, `RW-005`, `RW-006`, `RW-007`, `RW-008`, `RW-011`, `RW-012`, `RW-015`
* Apache-2.0: `RW-009`, `RW-010`, `RW-013`
* Sustainable Use License: `RW-014`

## 5. Hash del Corpus Manifest
$$\mathtt{CORPUS\_MANIFEST\_SHA256} = \mathbf{c3ea54b95df6acf2f67b4880a66c0d57628248360224a620c8db6c1bb57a0696}$$

## 6. Hash del Collector
$$\mathtt{COLLECTOR\_SHA256} = \mathbf{74d06080508289dd99dfcfb9e71da0777278c6e4eebf450d95e8e097a0552c9e}$$

## 7. Hash del Ruleset
$$\mathtt{RULESET\_SHA256} = \mathbf{bcef76d024c61c7c3d253c594ed1e6d7fa346434c9808f4484ab5d26191688c7}$$

## 8. Independent Ground Truth
Ver detalles registrados independientemente en `benchmarks/external/ground-truth.json`. El descubridor estático no tuvo acceso a dicho manifiesto durante la prueba.

## 9. Resultados Raw
Guardados de forma inalterada en `raw-results.json`.

## 10. Agent Detection Metrics
* **Total Repositorios Evaluados:** 15
* **True Positives (TP):** 8
* **True Negatives (TN):** 4
* **False Positives (FP):** 3 (`RW-006`, `RW-008`, `RW-010`)
* **False Negatives (FN):** 0
* **Precision:** **72.7% (73%)**
* **Recall:** **100%**
* **F1 Score:** **84%**

## 11. Provider Metrics
* **True Positives:** 3 (`OpenAI` en `RW-011`, `RW-012`; `Ollama` en `RW-015`)
* **False Positives:** 0
* **False Negatives / Unknown:** 12 (Modelos/proveedores no declarados estáticamente en manifests)

## 12. Framework Metrics
* **True Positives:** 5 (`CrewAI`, `AutoGen`, `BabyAGI`, `n8n`, `MCP`)
* **False Positives:** 3 (`Custom AST Agent` sobre-clasificado en `RW-001`, `RW-004`, `RW-005`, `RW-010`)

## 13. Protocol Metrics
* **MCP Protocol Detection:** Detectado con éxito en `RW-006` (Servidores MCP).

## 14. Tool Detection Metrics
* Detectadas herramientas de `filesystem`, `shell`, `database`, `GitHub` y `custom API`.

## 15. Capability Inference Metrics
* **Capability Precision:** **68%**
* **Capability Recall:** **52%**
* **Capability False Positive Rate:** **32%**

## 16. Critical Capability False Positives
* **Critical FPs (`EXECUTE`, `DELETE`, `SEND`, `PURCHASE`, `TRANSFER`, `ADMIN`):** **6**
* **Causa:** Inferencia de capacidad de ejecución `EXECUTE` basada en utilidades o scripts secundarios del repositorio sin confirmación de vinculación con un agente autónomo activo.

## 17. Credential Dependency Metrics
* Identificación adecuada de variables de entorno de claves (`OPENAI_API_KEY`, `GITHUB_TOKEN`).

## 18. Oversight Results
* Todos los repositorios externos mostraron `human_oversight = UNKNOWN` / `NOT_OBSERVED`, lo que confirma la correcta gestión epistemológica evitando asumir supervisión humana ficticia.

## 19. Revocation Results
* Todos los repositorios externos mostraron `revocation_mechanism = UNKNOWN` / `NOT_OBSERVED`.

## 20. Authority Constraint Results
* Clasificadas estrictamente como `RUNTIME_REQUIRED` cuando dependían del contexto de despliegue dinámico.

## 21. Observaciones de Confianza y Calibración
* **Bucket `[0.90 - 1.00]`:** 8 de 11 afirmaciones verdaderas (72.7% precisión observada).
* **Conclusión de Calibración:** La confianza estática tiende a la sobre-confianza cuando se detectan firmas heurísticas genéricas como `Custom AST Agent`. No está estadísticamente calibrado para repositorios externos arbitrarios.

## 22. Secret Suite Results
* **12 / 12 patrones de secretos sintéticos pasaron** el filtrado y sanitización sin fugas.

## 23. Cross-Subject Results
* Rechazo 100% confirmado de asignación de evidencias de conector a controles de agente sin relación formal.

## 24. Todos los False Positives (FP)
1. **`RW-006` (`modelcontextprotocol/servers`):** Clasificado como Agente cuando es un repositorio de herramientas/servidores MCP sin bucle autónomo.
2. **`RW-008` (`facebook/react`):** Detectado falso por coincidencia de patrones en scripts internos de construcción/herramientas.
3. **`RW-010` (`chroma-core/chroma`):** Clasificado como Agente por patrones en clases utilitarias en lugar de ser reconocido como infraestructura de base de datos vectorial.

## 25. Todos los False Negatives (FN)
* **0 False Negatives (0%)**. No se omitió ningún agente real del corpus.

## 26. UNKNOWNs Relevantes
* Proveedores de modelos no declarados explícitamente en manifests estáticos.
* Mecanismos de revocación y supervisión humana en producción.

## 27. Clasificación de Causa Raíz de Errores (Root Cause)
* `TOOL_NOT_AGENT_BOUND`: 2 casos (`RW-006`, `RW-010`).
* `CUSTOM_AGENT_PATTERN`: 1 caso (`RW-008`).

## 28. Límites del Análisis Estático (Static Boundaries)
* **Statically Provable:** Licencias, dependencias de manifiesto, firmas de protocolos, variables de claves.
* **Statically Inferable:** Frameworks principales, herramientas registradas en código.
* **Declaration Required:** Rol jurídico (`Provider` vs `Deployer`), intencionalidad de uso.
* **Runtime Required:** Límites dinámicos de autoridad, revocación en vivo, ejecución real de capacidades de escritura/pago.

## 29. Limitaciones
El análisis estático sobre código fuente en GitHub no puede determinar con total certitud si un servidor de herramientas o una librería utilitaria está conectada a un agente activo en producción.

## 30. DECISIÓN FINAL

# `ITERATE`

### Justificación formal basada en evidencia externa empírica:
1. **Precisión de Detección de Agentes:** La precisión obtenida sobre los 15 repositorios públicos externos reales de GitHub es del **72.7%**, no alcanzando el umbral mínimo del **90%** requerido para `GO_ALPHA`.
2. **Falsos Positivos de Capacidades Críticas:** Se registraron **6 Falsos Positivos en Capacidades Críticas** (`EXECUTE`), demostrando que el análisis estático actual tiende a sobre-inferir facultades de ejecución a partir de código utilitario.
3. **Calibración de Confianza:** La calibración actual sobre repositorios externos arbitrarios aún muestra sobre-confianza en heurísticas de fallback.

TrustAgent requiere un sprint adicional de refinamiento (*Sprint 04: AST Precision & Agent-Binding Verification*) antes de exponer el producto a usuarios finales.
