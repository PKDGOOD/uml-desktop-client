// UML DSL Grammar for peggy
// Supports: class, sequence, usecase, activity, state diagrams

{
  let _idCounter = 0;
  function makeId(prefix) {
    _idCounter++;
    return prefix + '_' + _idCounter + '_' + Math.random().toString(36).slice(2, 8);
  }

  function defaultSize(type) {
    switch (type) {
      case 'class': case 'interface': case 'abstract-class': case 'enum':
        return { width: 200, height: 150 };
      case 'actor':
        return { width: 60, height: 100 };
      case 'usecase':
        return { width: 160, height: 80 };
      case 'system-boundary':
        return { width: 400, height: 300 };
      case 'lifeline':
        return { width: 120, height: 400 };
      case 'action':
        return { width: 160, height: 60 };
      case 'decision':
        return { width: 80, height: 80 };
      case 'fork': case 'join':
        return { width: 200, height: 10 };
      case 'initial-node': case 'final-node':
      case 'initial-state': case 'final-state':
        return { width: 30, height: 30 };
      case 'state': case 'composite-state':
        return { width: 200, height: 120 };
      default:
        return { width: 150, height: 100 };
    }
  }

  function defaultPos(index) {
    return { x: 50 + (index % 4) * 250, y: 50 + Math.floor(index / 4) * 200 };
  }
}

// ============ Top-level ============

Diagram
  = (_ NL)* _ header:DiagramHeader _ NL* body:BodyItem* _ {
      const elements = [];
      const connectors = [];
      let elementIndex = 0;
      const nameToId = {};

      function addElement(item) {
        if (!item) return;
        const pos = item.position || defaultPos(elementIndex);
        const size = item.size || defaultSize(item.type);
        const id = makeId(item.type);
        nameToId[item.properties.name] = id;
        elements.push({
          id,
          type: item.type,
          position: pos,
          size: size,
          properties: item.properties,
        });
        elementIndex++;
        // Add children as separate elements (system-boundary, composite-state)
        if (item.children) {
          for (const child of item.children) {
            addElement(child);
          }
        }
      }

      for (const item of body) {
        if (!item) continue;
        if (item._nodeType === 'element') {
          addElement(item);
        } else if (item._nodeType === 'connector') {
          connectors.push(item);
        }
      }

      // Resolve connector source/target names to IDs
      for (const conn of connectors) {
        if (conn.type === 'transition' && (header.type === 'class' || header.type === 'usecase')) {
          conn.type = 'directed-association';
        }
        if (nameToId[conn.sourceId]) conn.sourceId = nameToId[conn.sourceId];
        if (nameToId[conn.targetId]) conn.targetId = nameToId[conn.targetId];
        delete conn._nodeType;
      }

      return {
        id: makeId('diagram'),
        name: header.name,
        type: header.type,
        elements,
        connectors,
        viewport: { x: 0, y: 0, zoom: 1.0 },
      };
    }

DiagramHeader
  = "@class-diagram" _ name:QuotedString { return { type: 'class', name }; }
  / "@sequence-diagram" _ name:QuotedString { return { type: 'sequence', name }; }
  / "@usecase-diagram" _ name:QuotedString { return { type: 'usecase', name }; }
  / "@activity-diagram" _ name:QuotedString { return { type: 'activity', name }; }
  / "@state-diagram" _ name:QuotedString { return { type: 'state', name }; }

BodyItem
  = _ NL { return null; }
  / _ item:(
      ClassDef
    / InterfaceDef
    / AbstractClassDef
    / EnumDef
    / LifelineDef
    / ActorDef
    / UsecaseDef
    / SystemBoundaryDef
    / ActionDef
    / DecisionDef
    / ForkDef
    / JoinDef
    / InitialNodeDef
    / FinalNodeDef
    / CompositeStateDef
    / StateDef
    / InitialStateDef
    / FinalStateDef
    / MessageDef
    / UsecaseRelationDef
    / TransitionDef
    / RelationDef
  ) _ NL? { return item; }

// ============ Annotations: @pos(x,y) @size(w,h) ============

PosAnnotation
  = "@pos" _ "(" _ x:Integer _ "," _ y:Integer _ ")" {
      return { x, y };
    }

SizeAnnotation
  = "@size" _ "(" _ w:Integer _ "," _ h:Integer _ ")" {
      return { width: w, height: h };
    }

Annotations
  = pos:(_ PosAnnotation)? size:(_ SizeAnnotation)? {
      return {
        position: pos ? pos[1] : null,
        size: size ? size[1] : null,
      };
    }

// ============ Class Diagram Elements ============

ClassDef
  = "class" S name:IdentifierOrQuoted ann:Annotations _ "{" _ NL members:MemberLine* _ "}" {
      const attrs = [];
      const methods = [];
      for (const m of members) {
        if (!m) continue;
        if (m._memberType === 'method') methods.push({ name: m.name, returnType: m.returnType, parameters: m.parameters, visibility: m.visibility });
        else attrs.push({ name: m.name, type: m.type, visibility: m.visibility });
      }
      return {
        _nodeType: 'element',
        type: 'class',
        position: ann.position,
        size: ann.size,
        properties: { name, attributes: attrs, methods },
      };
    }

AbstractClassDef
  = "abstract" S "class" S name:IdentifierOrQuoted ann:Annotations _ "{" _ NL members:MemberLine* _ "}" {
      const attrs = [];
      const methods = [];
      for (const m of members) {
        if (!m) continue;
        if (m._memberType === 'method') methods.push({ name: m.name, returnType: m.returnType, parameters: m.parameters, visibility: m.visibility });
        else attrs.push({ name: m.name, type: m.type, visibility: m.visibility });
      }
      return {
        _nodeType: 'element',
        type: 'abstract-class',
        position: ann.position,
        size: ann.size,
        properties: { name, attributes: attrs, methods },
      };
    }

InterfaceDef
  = "interface" S name:IdentifierOrQuoted ann:Annotations _ "{" _ NL members:MemberLine* _ "}" {
      const attrs = [];
      const methods = [];
      for (const m of members) {
        if (!m) continue;
        if (m._memberType === 'method') methods.push({ name: m.name, returnType: m.returnType, parameters: m.parameters, visibility: m.visibility });
        else attrs.push({ name: m.name, type: m.type, visibility: m.visibility });
      }
      return {
        _nodeType: 'element',
        type: 'interface',
        position: ann.position,
        size: ann.size,
        properties: { name, attributes: attrs, methods },
      };
    }

EnumDef
  = "enum" S name:IdentifierOrQuoted ann:Annotations _ "{" _ NL values:EnumLine* _ "}" {
      const filtered = values.filter(Boolean);
      return {
        _nodeType: 'element',
        type: 'enum',
        position: ann.position,
        size: ann.size,
        properties: { name, attributes: filtered.map(v => ({ name: v, type: '', visibility: 'public' })), methods: [] },
      };
    }

MemberLine
  = _ m:(MethodMember / AttributeMember) _ NL { return m; }
  / _ NL { return null; }

AttributeMember
  = vis:VisibilityMarker S name:Identifier _ ":" _ type:TypeExpr {
      return { _memberType: 'attribute', name, type, visibility: vis };
    }

MethodMember
  = vis:VisibilityMarker S name:Identifier _ "(" _ params:ParameterList _ ")" _ ":" _ ret:TypeExpr {
      return { _memberType: 'method', name, returnType: ret, parameters: params, visibility: vis };
    }

VisibilityMarker
  = "+" { return 'public'; }
  / "-" { return 'private'; }
  / "#" { return 'protected'; }
  / "~" { return 'package'; }

ParameterList
  = head:Parameter tail:(_ "," _ Parameter)* {
      return [head, ...tail.map(t => t[3])];
    }
  / "" { return []; }

Parameter
  = name:Identifier _ ":" _ type:TypeExpr {
      return { name, type };
    }

TypeExpr
  = chars:TypeChar+ { return chars.join('').trim(); }

TypeChar
  = [a-zA-Z0-9_\[\]<>,.\u00C0-\u024F\uAC00-\uD7AF ]

EnumLine
  = _ name:Identifier _ NL { return name; }
  / _ NL { return null; }

// ============ Class Diagram Relations ============

RelationDef
  = src:IdentifierOrQuoted _ srcMult:Multiplicity? _ rel:RelationType _ tgtMult:Multiplicity? _ tgt:IdentifierOrQuoted label:(_ ":" _ LabelText)? {
      return {
        _nodeType: 'connector',
        id: makeId('conn'),
        type: rel,
        sourceId: src,
        targetId: tgt,
        sourceMultiplicity: srcMult || undefined,
        targetMultiplicity: tgtMult || undefined,
        label: label ? label[3] : undefined,
        properties: {},
      };
    }

Multiplicity
  = '"' chars:[^"]* '"' _ { return chars.join(''); }

RelationType
  = "..|>" { return 'realization'; }
  / "<|.." { return 'realization'; }
  / "--|>" { return 'inheritance'; }
  / "<|--" { return 'inheritance'; }
  / "--o" { return 'aggregation'; }
  / "o--" { return 'aggregation'; }
  / "--*" { return 'composition'; }
  / "*--" { return 'composition'; }
  / "..>" { return 'dependency'; }
  / "---" { return 'association'; }
  / "-->" { return 'directed-association'; }
  / "--" { return 'association'; }

// ============ Sequence Diagram Elements ============

LifelineDef
  = "lifeline" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'lifeline',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

MessageDef
  = src:IdentifierOrQuoted _ msgType:MessageType _ tgt:IdentifierOrQuoted _ ":" _ label:LabelText {
      return {
        _nodeType: 'connector',
        id: makeId('conn'),
        type: msgType,
        sourceId: src,
        targetId: tgt,
        label: label,
        properties: {},
      };
    }

MessageType
  = "->>" { return 'async-message'; }
  / "<--" { return 'return-message'; }
  / "->" { return 'sync-message'; }

// ============ Usecase Diagram Elements ============

ActorDef
  = "actor" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'actor',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

UsecaseDef
  = "usecase" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'usecase',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

SystemBoundaryDef
  = "system-boundary" S name:IdentifierOrQuoted ann:Annotations _ "{" _ NL items:SystemBoundaryItem* _ "}" {
      const children = items.filter(Boolean);
      return {
        _nodeType: 'element',
        type: 'system-boundary',
        position: ann.position,
        size: ann.size,
        properties: { name },
        children: children,
      };
    }

SystemBoundaryItem
  = _ item:UsecaseDef _ NL { return item; }
  / _ NL { return null; }

UsecaseRelationDef
  = src:IdentifierOrQuoted _ "-->" _ tgt:IdentifierOrQuoted _ stereotype:UsecaseStereotype {
      return {
        _nodeType: 'connector',
        id: makeId('conn'),
        type: stereotype,
        sourceId: src,
        targetId: tgt,
        properties: {},
      };
    }
  / src:IdentifierOrQuoted _ "..>" _ tgt:IdentifierOrQuoted _ stereotype:UsecaseStereotype {
      return {
        _nodeType: 'connector',
        id: makeId('conn'),
        type: stereotype,
        sourceId: src,
        targetId: tgt,
        properties: {},
      };
    }

UsecaseStereotype
  = "<<include>>" { return 'include'; }
  / "<<extend>>" { return 'extend'; }

// ============ Activity Diagram Elements ============

ActionDef
  = "action" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'action',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

DecisionDef
  = "decision" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'decision',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

ForkDef
  = "fork" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'fork',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

JoinDef
  = "join" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'join',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

InitialNodeDef
  = "initial-node" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'initial-node',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

FinalNodeDef
  = "final-node" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'final-node',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

// ============ State Diagram Elements ============

StateDef
  = "state" S name:IdentifierOrQuoted ann:Annotations !(_ "{") {
      return {
        _nodeType: 'element',
        type: 'state',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

CompositeStateDef
  = "composite-state" S name:IdentifierOrQuoted ann:Annotations _ "{" _ NL items:CompositeStateItem* _ "}" {
      const children = items.filter(Boolean);
      return {
        _nodeType: 'element',
        type: 'composite-state',
        position: ann.position,
        size: ann.size,
        properties: { name },
        children: children,
      };
    }

CompositeStateItem
  = _ item:(StateDef / InitialStateDef / FinalStateDef / TransitionDef) _ NL { return item; }
  / _ NL { return null; }

InitialStateDef
  = "initial-state" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'initial-state',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

FinalStateDef
  = "final-state" S name:IdentifierOrQuoted ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'final-state',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

// ============ Transitions (activity + state) ============

TransitionDef
  = src:IdentifierOrQuoted _ "-->" _ tgt:IdentifierOrQuoted label:(_ ":" _ LabelText)? {
      return {
        _nodeType: 'connector',
        id: makeId('conn'),
        type: 'transition',
        sourceId: src,
        targetId: tgt,
        label: label ? label[3] : undefined,
        properties: {},
      };
    }

// ============ Primitives ============

QuotedString
  = '"' ("\\" . / [^"\\])* '"' { return JSON.parse(text()); }

IdentifierOrQuoted
  = QuotedString
  / Identifier

Identifier
  = head:[a-zA-Z_\u00C0-\u024F\uAC00-\uD7AF] tail:[a-zA-Z0-9_\u00C0-\u024F\uAC00-\uD7AF]* { return head + tail.join(''); }

LabelText
  = chars:[^\n\r]+ { return chars.join('').trim(); }

Integer
  = digits:[0-9]+ { return parseInt(digits.join(''), 10); }

// Horizontal whitespace (no newlines)
_ "whitespace"
  = [ \t]* ("//" [^\n\r]*)?

// Required horizontal whitespace
S "required space"
  = [ \t]+

// Newline
NL "newline"
  = "\r\n" / "\n" / "\r"
