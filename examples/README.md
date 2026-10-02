# Synthetic UML fixtures

All examples are invented order-service designs and contain no company documents. `order-system.uml` is the quick-start snippet. The `alpha-*` corpus is the baseline for [D-01–D-05](../docs/product-spec.md); it does not imply complete support for those contracts.

| Fixture | Exercise | Expected result |
| --- | --- | --- |
| [Class](alpha-class.uml) | Attributes, parameterized methods, enum, interface, abstract class, composition/inheritance/dependency, Unicode title | Five named elements, four directed relations; `Order` contains `OrderItem`; method signatures retained |
| [Sequence](alpha-sequence.uml) | Korean participant, synchronous/asynchronous/return messages and long label | Three lifelines, three messages in the declared order |
| [Use case](alpha-usecase.uml) | Boundary, internal use cases, external actor/use case, include/extend | `CancelOrder` and `RefundPayment` inside `OrderSystem`; `ContactSupport` and actor outside |
| [Activity](alpha-activity.uml) | Initial/final, action, decision, fork/join, labeled alternatives | Eight nodes, nine directed transitions, both branches preserved |
| [State](alpha-state.uml) | Composite with a nested state and external sibling/pseudostates | `Inside` belongs to `Active`; `Outside` and `End` remain top level |

[alpha-expectations.json](alpha-expectations.json) is the independent name/type/endpoint/order/ownership oracle. [alphaFixtures.test.ts](../src/engine/alphaFixtures.test.ts) currently checks parsing and exact raw-draft project persistence. Its passing status does **not** assert ownership survives model-to-DSL serialization: F2 explicitly fails that contract in [readinessRegression.test.ts](../src/engine/readinessRegression.test.ts).

To inspect a fixture, create the matching diagram type and paste its entire text into the editor. Save a project as `.uml.json`; Open takes project JSON, not a raw `.uml` file. Later five-type GUI/export acceptance must compare each result with the oracle and test guide rather than accepting a screenshot alone.
