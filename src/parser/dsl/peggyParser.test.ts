import { describe, it, expect, beforeEach } from 'vitest';
import { parseDSL, resetParser } from './peggyParser';

beforeEach(() => {
  resetParser();
});

it('accepts comments before the header and inside class declarations', () => {
  const result = parseDSL('\n// design notes\n@class-diagram "Comments"\nclass Order {\n  // identifier\n  - id: string // internal\n}\n');
  expect(result.success).toBe(true);
  if (result.success) expect(result.diagram.elements[0].properties.attributes?.[0].name).toBe('id');
});

it('reports error lines relative to the original text including leading blank lines', () => {
  const result = parseDSL('\n\n@class-diagram "Broken"\n\nclass {{{');
  expect(result.success).toBe(false);
  if (!result.success) expect(result.errors[0].line).toBe(5);
});

// =============================================================================
// Class Diagram
// =============================================================================

describe('parseDSL - class diagram', () => {
  it('parses a class with attributes and methods', () => {
    const dsl = `@class-diagram "주문 시스템"

class Order {
  - id: string
  - items: OrderItem[]
  + addItem(item: OrderItem): void
  + calculateTotal(): number
}
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('class');
    expect(result.diagram.name).toBe('주문 시스템');
    expect(result.diagram.elements).toHaveLength(1);

    const order = result.diagram.elements[0];
    expect(order.type).toBe('class');
    expect(order.properties.name).toBe('Order');
    expect(order.properties.attributes).toHaveLength(2);
    expect(order.properties.attributes![0]).toEqual({ name: 'id', type: 'string', visibility: 'private' });
    expect(order.properties.attributes![1]).toEqual({ name: 'items', type: 'OrderItem[]', visibility: 'private' });
    expect(order.properties.methods).toHaveLength(2);
    expect(order.properties.methods![0].name).toBe('addItem');
    expect(order.properties.methods![0].returnType).toBe('void');
    expect(order.properties.methods![0].parameters).toEqual([{ name: 'item', type: 'OrderItem' }]);
    expect(order.properties.methods![1].name).toBe('calculateTotal');
  });

  it('parses interface definition', () => {
    const dsl = `@class-diagram "Interfaces"

interface Printable {
  + print(): void
}
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.elements).toHaveLength(1);
    expect(result.diagram.elements[0].type).toBe('interface');
    expect(result.diagram.elements[0].properties.name).toBe('Printable');
  });

  it('parses abstract class definition', () => {
    const dsl = `@class-diagram "Abstract"

abstract class Shape {
  # color: string
  + draw(): void
}
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.elements[0].type).toBe('abstract-class');
    expect(result.diagram.elements[0].properties.attributes![0].visibility).toBe('protected');
  });

  it('parses enum definition', () => {
    const dsl = `@class-diagram "Enums"

enum Color {
  RED
  GREEN
  BLUE
}
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const el = result.diagram.elements[0];
    expect(el.type).toBe('enum');
    expect(el.properties.attributes).toHaveLength(3);
    expect(el.properties.attributes![0].name).toBe('RED');
  });

  it('parses relationships with multiplicities', () => {
    const dsl = `@class-diagram "Relations"

class Order {
  - id: string
}

class OrderItem {
  - quantity: number
}

Order "1" --> "*" OrderItem : contains
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.connectors).toHaveLength(1);
    const conn = result.diagram.connectors[0];
    expect(conn.type).toBe('directed-association');
    expect(conn.sourceMultiplicity).toBe('1');
    expect(conn.targetMultiplicity).toBe('*');
    expect(conn.label).toBe('contains');
  });

  it('parses inheritance relationship', () => {
    const dsl = `@class-diagram "Inheritance"

class Animal {
  + name: string
}

class Dog {
  + breed: string
}

Dog --|> Animal
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.connectors[0].type).toBe('inheritance');
  });

  it('parses realization relationship', () => {
    const dsl = `@class-diagram "Realization"

class MyClass {
  + doSomething(): void
}

interface MyInterface {
  + doSomething(): void
}

MyClass ..|> MyInterface
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.connectors[0].type).toBe('realization');
  });

  it('parses aggregation and composition', () => {
    const dsl = `@class-diagram "Aggregation"

class A {
  + x: int
}

class B {
  + y: int
}

class C {
  + z: int
}

A --o B
A --* C
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.connectors[0].type).toBe('aggregation');
    expect(result.diagram.connectors[1].type).toBe('composition');
  });
});

// =============================================================================
// Sequence Diagram
// =============================================================================

describe('parseDSL - sequence diagram', () => {
  it('parses lifelines and messages', () => {
    const dsl = `@sequence-diagram "Login Flow"

lifeline User
lifeline Server
lifeline DB

User -> Server : login(credentials)
Server -> DB : query(user)
DB <-- Server : userData
Server <-- User : loginResult
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('sequence');
    expect(result.diagram.elements).toHaveLength(3);
    expect(result.diagram.elements[0].type).toBe('lifeline');
    expect(result.diagram.elements[0].properties.name).toBe('User');

    expect(result.diagram.connectors).toHaveLength(4);
    expect(result.diagram.connectors[0].type).toBe('sync-message');
    expect(result.diagram.connectors[0].label).toBe('login(credentials)');
    expect(result.diagram.connectors[2].type).toBe('return-message');
  });

  it('parses async messages', () => {
    const dsl = `@sequence-diagram "Async"

lifeline A
lifeline B

A ->> B : asyncCall
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.connectors[0].type).toBe('async-message');
  });
});

// =============================================================================
// Usecase Diagram
// =============================================================================

describe('parseDSL - usecase diagram', () => {
  it('parses actors and usecases', () => {
    const dsl = `@usecase-diagram "Shopping"

actor Customer
usecase "Browse Products"
usecase "Place Order"

Customer --> "Browse Products"
Customer --> "Place Order"
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('usecase');
    expect(result.diagram.elements).toHaveLength(3);
    expect(result.diagram.elements[0].type).toBe('actor');
    expect(result.diagram.elements[1].type).toBe('usecase');
    expect(result.diagram.elements[1].properties.name).toBe('Browse Products');
    expect(result.diagram.elements[2].properties.name).toBe('Place Order');
  });

  it('parses system boundary with nested usecases', () => {
    const dsl = `@usecase-diagram "System"

actor Admin

system-boundary "Backend" {
  usecase "Manage Users"
  usecase "View Reports"
}
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // system-boundary + 2 nested usecases = 4 elements (actor + boundary + 2 usecases)
    expect(result.diagram.elements.length).toBeGreaterThanOrEqual(3);
    const boundary = result.diagram.elements.find(e => e.type === 'system-boundary');
    expect(boundary).toBeDefined();
    expect(boundary!.properties.name).toBe('Backend');
  });

  it('parses include/extend stereotypes', () => {
    const dsl = `@usecase-diagram "Stereotypes"

usecase "Place Order"
usecase "Validate Payment"
usecase "Apply Discount"

"Place Order" ..> "Validate Payment" <<include>>
"Place Order" ..> "Apply Discount" <<extend>>
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.connectors).toHaveLength(2);
    expect(result.diagram.connectors[0].type).toBe('include');
    expect(result.diagram.connectors[1].type).toBe('extend');
  });
});

// =============================================================================
// Activity Diagram
// =============================================================================

describe('parseDSL - activity diagram', () => {
  it('parses actions and transitions', () => {
    const dsl = `@activity-diagram "Order Process"

initial-node start
action "Receive Order"
action "Process Payment"
decision "Payment OK?"
action "Ship Order"
final-node end

start --> "Receive Order"
"Receive Order" --> "Process Payment"
"Process Payment" --> "Payment OK?"
"Payment OK?" --> "Ship Order" : [yes]
"Ship Order" --> end
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('activity');
    expect(result.diagram.elements.length).toBeGreaterThanOrEqual(5);
    expect(result.diagram.connectors.length).toBeGreaterThanOrEqual(4);

    const decision = result.diagram.elements.find(e => e.type === 'decision');
    expect(decision).toBeDefined();
    expect(decision!.properties.name).toBe('Payment OK?');
  });

  it('parses fork and join', () => {
    const dsl = `@activity-diagram "Parallel"

action A
fork F1
action B
action C
join J1
action D

A --> F1
F1 --> B
F1 --> C
B --> J1
C --> J1
J1 --> D
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.elements.find(e => e.type === 'fork')).toBeDefined();
    expect(result.diagram.elements.find(e => e.type === 'join')).toBeDefined();
  });
});

// =============================================================================
// State Diagram
// =============================================================================

describe('parseDSL - state diagram', () => {
  it('parses states and transitions', () => {
    const dsl = `@state-diagram "Order States"

initial-state init
state Pending
state Processing
state Shipped
state Delivered
final-state done

init --> Pending
Pending --> Processing : pay
Processing --> Shipped : ship
Shipped --> Delivered : deliver
Delivered --> done
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.diagram.type).toBe('state');
    expect(result.diagram.elements.length).toBeGreaterThanOrEqual(5);
    expect(result.diagram.connectors).toHaveLength(5);
    expect(result.diagram.connectors[1].label).toBe('pay');
  });

  it('parses composite state', () => {
    const dsl = `@state-diagram "Composite"

state Active
composite-state "Processing" {
  initial-state s0
  state Validating
  state Executing
  final-state sf
  s0 --> Validating
  Validating --> Executing
  Executing --> sf
}

Active --> "Processing"
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const composite = result.diagram.elements.find(e => e.type === 'composite-state');
    expect(composite).toBeDefined();
    expect(composite!.properties.name).toBe('Processing');
    // Children should be flattened into elements
    expect(result.diagram.elements.filter(e => e.type === 'state').length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Annotations (@pos, @size)
// =============================================================================

describe('parseDSL - annotations', () => {
  it('parses @pos and @size annotations', () => {
    const dsl = `@class-diagram "Layout"

class MyClass @pos(100, 200) @size(300, 150) {
  + name: string
}
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const el = result.diagram.elements[0];
    expect(el.position).toEqual({ x: 100, y: 200 });
    expect(el.size).toEqual({ width: 300, height: 150 });
  });

  it('uses default position/size when annotations are absent', () => {
    const dsl = `@class-diagram "Defaults"

class Simple {
  + x: int
}
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const el = result.diagram.elements[0];
    expect(el.position).toBeDefined();
    expect(el.size).toEqual({ width: 200, height: 150 });
  });
});

// =============================================================================
// Error handling
// =============================================================================

describe('parseDSL - error handling', () => {
  it('returns error for empty input', () => {
    const result = parseDSL('');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].message).toBe('Empty DSL text');
  });

  it('returns error with line/column for invalid syntax', () => {
    const result = parseDSL('this is not valid DSL');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].line).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].column).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].message).toBeTruthy();
  });

  it('returns error for missing diagram name', () => {
    const result = parseDSL('@class-diagram\nclass Foo {\n}');
    expect(result.success).toBe(false);
  });

  it('returns error for unknown header', () => {
    const result = parseDSL('@unknown-diagram "Test"');
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// DSLParseResult type conformance
// =============================================================================

describe('parseDSL - result structure', () => {
  it('returns DiagramData with all required fields on success', () => {
    const dsl = `@class-diagram "Test"

class A {
  + x: int
}
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const d = result.diagram;
    expect(d.id).toBeTruthy();
    expect(d.name).toBe('Test');
    expect(d.type).toBe('class');
    expect(Array.isArray(d.elements)).toBe(true);
    expect(Array.isArray(d.connectors)).toBe(true);
    expect(d.viewport).toEqual({ x: 0, y: 0, zoom: 1.0 });
  });

  it('resolves connector sourceId/targetId to element IDs', () => {
    const dsl = `@class-diagram "Resolve"

class A {
  + x: int
}

class B {
  + y: int
}

A --> B
`;
    const result = parseDSL(dsl);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const conn = result.diagram.connectors[0];
    const aId = result.diagram.elements.find(e => e.properties.name === 'A')!.id;
    const bId = result.diagram.elements.find(e => e.properties.name === 'B')!.id;
    expect(conn.sourceId).toBe(aId);
    expect(conn.targetId).toBe(bId);
  });
});
