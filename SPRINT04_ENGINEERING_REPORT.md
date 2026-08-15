# SPRINT 04 ENGINEERING REPORT — AI ESTATE CLASSIFICATION & CAPABILITY PRECISION

## 1. Baseline 03B (Punto de Partida Oficial)
* **Agent Detection Baseline:** Precision: **72.7%**, Recall: **100%**, F1: **84.2%**.
* **Capability Inference Baseline:** Precision: **68%**, Recall: **52%**, False Positive Rate: **32%**.
* **Falsos Positivos de Ejecución Crítica:** **6 EXECUTE False Positives**.

## 2. Root Cause de los 3 Agent FP del Sprint 03B
* `RW-006` (`modelcontextprotocol/servers`): Coincidencia de manifiesto `@modelcontextprotocol/sdk`. La versión 03B sobre-clasificó el servidor de herramientas como agente autónomo.
* `RW-008` (`facebook/react`): Coincidencia de expresiones regulares en scripts internos de construcción/despliegue.
* `RW-010` (`chroma-core/chroma`): Coincidencia con clases utilitarias de cliente en la base de datos vectorial sin aislar la capa de infraestructura.

## 3. Ontología del AI Estate (`AssetType`)
Se implementó en `src/scanner/types.ts` una taxonomía enriquecida para superar el modelo binario `AGENT / NOT_AGENT`:
`AGENT` | `AGENT_RUNTIME` | `AGENT_FRAMEWORK` | `AI_APPLICATION` | `CHATBOT` | `RAG_SYSTEM` | `MCP_SERVER` | `MCP_CLIENT` | `TOOL_SERVER` | `MODEL_PROVIDER` | `MODEL_RUNTIME` | `VECTOR_STORE` | `SDK_LIBRARY` | `ORCHESTRATOR` | `AUTOMATION_PLATFORM` | `AI_INFRASTRUCTURE` | `NON_AI` | `UNKNOWN`

## 4. Arquitectura de Clasificación (`ScannerCore`)
Se creó `src/scanner/scannerCore.ts`, un motor estático determinista de cero dependencias (sin Express, React, SQLite ni conceptos SaaS). Recibe como entrada una ruta del sistema de archivos y devuelve un resultado estructurado `AIEstateScanResult`.

## 5. Modelo de Evidencia Positiva
Jerarquía de fuerza de evidencia (`EvidenceStrength`):
$$\mathtt{FRAMEWORK\_DEPENDENCY (0.2)} \rightarrow \mathtt{AGENT\_CLASS\_IMPORT (0.4)} \rightarrow \mathtt{FUNCTION\_DEFINED (0.5)} \rightarrow \mathtt{TOOL\_REGISTERED (0.7)} \rightarrow \mathtt{AGENT\_BOUND (0.85)} \rightarrow \mathtt{ENTRYPOINT\_REACHABLE (0.95)} \rightarrow \mathtt{RUNTIME\_CONFIRMED (1.0)}$$

## 6. Modelo de Evidencia Negativa y Penalización
Se introdujo la detección de señales contradictorias (`CONVENTIONAL_NON_AI_LIBRARY`, `INFRASTRUCTURE_ONLY`, `AI_SDK_LIBRARY_WITHOUT_AGENT_CONSTRUCTION`) que degradan la confianza o reclasifican la entidad a `SDK_LIBRARY`, `VECTOR_STORE` o `NON_AI`.

## 7. Modelo de Ruta de Código (Code-Path Model)
Diferenciación entre:
$\text{Dependency Installed} \rightarrow \text{Dependency Imported} \rightarrow \text{Symbol Referenced} \rightarrow \text{Function Defined} \rightarrow \text{Tool Registered} \rightarrow \text{Agent Bound} \rightarrow \text{Entrypoint Reachable}$

## 8. Capability Binding Graph
Representación explícita mediante enlaces `CapabilityBindingEdge`:
$$\mathtt{Asset} \xrightarrow{\text{binds}} \mathtt{Tool} \xrightarrow{\text{invokes}} \mathtt{Function/API} \xrightarrow{\text{accesses}} \mathtt{Resource} \xrightarrow{\text{grants}} \mathtt{Capability} \xrightarrow{\text{constrains}} \mathtt{Constraint}$$

## 9. Contrato de Declaración de Capacidades (Capability Claim Contract)
Toda capacidad incluye: `subject`, `action`, `resource`, `constraint`, `status`, `evidenceStrength`, `confidence`, y `provenance`.

## 10. Política de Capacidades Críticas
Para acciones sensibles (`DELETE`, `EXECUTE`, `SEND`, `PUBLISH`, `APPROVE`, `PURCHASE`, `TRANSFER`, `ADMIN`), **SE EXIGE COMO MÍNIMO `AGENT_BOUND` o `ENTRYPOINT_REACHABLE`**. Si sólo existe evidencia de utilidad o función no vinculada, la capacidad no se atribuye al agente y se registra como `POTENTIAL_FUNCTIONALITY_NOT_BOUND`.

## 11. Separación del Scanner Open Core
El motor `ScannerCore` ha quedado aislado en `src/scanner/` listo para ser empaquetado como el módulo npm independiente `@trustagent/scanner-core`.

## 12. Resultados en el Corpus de Desarrollo (15 Repos 03B)
Tras el refactor a la ontología del AI Estate, los repositorios de prueba de desarrollo fueron reclasificados correctamente, reduciendo los falsos positivos en capacidades críticas a 0.

## 13. Manifiesto del Holdout Corpus (`SPRINT04_HOLDOUT_MANIFEST.json`)
Corpus ciego de **10 repositorios públicos reales de GitHub** jamás vistos durante el desarrollo:
1. `H-001`: `phidata-inc/phidata` (Multi-agent framework)
2. `H-002`: `geekan/MetaGPT` (Multi-agent software role framework)
3. `H-003`: `BerriAI/litellm` (LLM proxy client SDK)
4. `H-004`: `qdrant/qdrant` (Vector database engine in Rust)
5. `H-005`: `fastapi/fastapi` (Python web API framework)
6. `H-006`: `ollama/ollama` (Go local model runtime server)
7. `H-007`: `xai-org/grok-1` (Model weights repository)
8. `H-008`: `gpt-engineer-org/gpt-engineer` (Autonomous coding agent)
9. `H-009`: `milvus-io/milvus` (Cloud-native vector database)
10. `H-010`: `nestjs/nest` (TypeScript backend framework)

## 14. Hashes de Congelamiento (`SPRINT04_EVALUATION_FREEZE.json`)
$$\mathtt{SCANNER\_SHA256} = \mathbf{c21d4b3c7fefd03c4a466c18bf4dd267fc145281f0848265c1e8d4c2709874d3}$$
$$\mathtt{RULESET\_SHA256} = \mathbf{7bffd0c6ceb4e2b75c139076e416939751a46a074cd801cc784a273216b2766a}$$
$$\mathtt{HOLDOUT\_MANIFEST\_SHA256} = \mathbf{dc0794c30332bb3a9c65f20001c63b955eca38b19ec6a30ff4fcddee61e62bde}$$

## 15. Holdout Raw Results
Almacenados de forma inalterada en `sprint04-raw-results.json`.

## 16. Matriz de Confusión de Activos (Asset Confusion Matrix)

| Ground Truth \ Detected | AGENT | NON_AI | VECTOR_STORE | SDK_LIBRARY | MODEL_RUNTIME | MODEL_PROVIDER |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AGENT** | **2 (TP)** | 1 (FN) | 0 | 0 | 0 | 0 |
| **NON_AI** | **2 (FP)** | 0 | 0 | 0 | 0 | 0 |
| **VECTOR_STORE** | **2 (FP)** | 0 | 0 | 0 | 0 | 0 |
| **SDK_LIBRARY** | **1 (FP)** | 0 | 0 | 0 | 0 | 0 |
| **MODEL_RUNTIME** | 0 | **1 (TN)** | 0 | 0 | 0 | 0 |
| **MODEL_PROVIDER** | **1 (FP)** | 0 | 0 | 0 | 0 | 0 |

## 17. Agent Precision / Recall en el Holdout Corpus
* **Agent True Positives (TP):** 2 (`H-002` MetaGPT, `H-008` GPT Engineer)
* **Agent True Negatives (TN):** 1 (`H-006` Ollama)
* **Agent False Positives (FP):** 6 (`H-003`, `H-004`, `H-005`, `H-007`, `H-009`, `H-010`)
* **Agent False Negatives (FN):** 1 (`H-001` Phidata)
* **Agent Detection Precision:** **25%**
* **Agent Detection Recall:** **67%**
* **Agent Detection F1 Score:** **36%**

## 18. Tool Metrics
* Herramientas detectadas y vinculadas correctamente en agentes confirmados (`H-002`, `H-008`).

## 19. Capability Metrics en el Holdout Corpus
* **All Capability Precision:** **50%**
* **All Capability Recall:** **47%**

## 20. Critical Capability FP Report
* **Falsos Positivos de Capacidades Críticas (`EXECUTE`):** **2**
* **Análisis de causa raíz:** Ocurrieron en repositorios de infraestructura de bases de datos vectoriales (`qdrant`, `milvus`) debido a scripts de construcción y utilidades de línea de comandos en subdirectorios no excluidos.

## 21. Observaciones de Confianza
Las puntuaciones de confianza estática basadas únicamente en coincidencia AST primaria demuestran sobre-confianza cuando se aplican a repositorios complejos no vistos previamente que contienen utilidades internas.

## 22. Secret Tests Results
* **12 / 12 patrones de secretos sintéticos pasaron** el filtrado y sanitización sin fugas.

## 23. Verificación de Provenance
100% de las afirmaciones materiales emitidas contienen su archivo de procedencia y snippet asociado.

## 24. Static Analysis Boundaries
* **STATICALLY_PROVABLE:** Licencias, archivos manifiesto (`package.json`, `pyproject.toml`), dependencias importadas.
* **STATICALLY_INFERABLE:** Frameworks principales de agentes, herramientas explícitamente registradas.
* **DECLARATION_REQUIRED:** Propósito de negocio del agente, roles de operadores (`Provider` vs `Deployer`).
* **CONNECTED_EVIDENCE_REQUIRED:** Conexión real de conectores y permisos asignados en vivo.
* **RUNTIME_REQUIRED:** Verificación en tiempo de ejecución de si una capacidad es efectivamente invocada por un LLM en producción.

## 25. Limitaciones Restantes
El análisis estático puramente basado en código fuente en repositorios desconocidos no puede garantizar por sí solo la diferenciación entre un script de utilidad de construcción y un agente ejecutor de código autónomo.

## 26. Viabilidad de Open-Source Scanner
Es totalmente viable extraer `src/scanner/` a un paquete independiente `@trustagent/scanner-core` con salidas estructuradas en JSON y exportador SARIF para integración con GitHub Actions / GitLab CI.

## 27. Implicaciones para la Capa Comercial (TrustAgent Cloud)
La capa SaaS comercial no debe confiar exclusivamente en descubrimientos estáticos no confirmados. Debe exigir evidencias conectadas (*Level 2 Connected Evidence*) o declaraciones humanas (*Level 2 Declared*) antes de clasificar un activo como `GOVERNED`.

## 28. DECISIÓN FINAL

# `ITERATE`

### Justificación formal basada en evidencia empírica ciega:
1. **Precisión en Repositorios Desconocidos (Holdout):** La precisión del motor estático ante el Holdout Corpus ciego de 10 repositorios fue del **25%** (con 6 Falsos Positivos), situándose muy por debajo del objetivo del **90%** necesario para la fase Alpha.
2. **Requisito de Evidencia Conectada:** La prueba empírica demuestra que el análisis estático debe complementarse obligatoriamente con un manifest formal (`trustagent.yaml`) o con conectores en vivo (*Connected Evidence*) para alcanzar la fiabilidad requerida por empresas y PYMEs.

TrustAgent requiere pasar a la fase de integración de conectores y manifiestos explícitos en el **Sprint 05**.
