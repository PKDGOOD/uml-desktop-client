// UML DSL Grammar for peggy
// Supports: class, sequence, usecase, activity, state diagrams

{
  function makeId(name) {
    return name.replace(/\s+/g, '_').toLowerCase() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function defaultSize(type) {
    switch(type) {
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
  = _ header:DiagramHeader EOL body:BodyItem* _ {
      const elements = [];
      const connectors = [];
      let elementIndex = 0;
      const nameToId = {};

      for (const item of body) {
        if (!item) continue;
        if (item._nodeType === 'element') {
          const pos = item.position || defaultPos(elementIndex);
          const size = item.size || defaultSize(item.type);
          const id = item.id || makeId(item.properties.name);
          nameToId[item.properties.name] = id;
          elements.push({
            id,
            type: item.type,
            position: pos,
            size: size,
            properties: item.properties,
          });
          elementIndex++;
        } else if (item._nodeType === 'connector') {
          connectors.push(item);
        }
      }

      for (const conn of connectors) {
        if (nameToId[conn.sourceId]) conn.sourceId = nameToId[conn.sourceId];
        if (nameToId[conn.targetId]) conn.targetId = nameToId[conn.targetId];
        delete conn._nodeType;
      }

      return {
        id: makeId(header.name),
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
  = NL* _ item:(
      ClassDef
    / InterfaceDef
    / AbstractClassDef
    / EnumDef
    / LifelineDef
    / MessageDef
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
    / TransitionDef
    / RelationDef
  ) _ NL { return item; }

// ============ Position Annotation ============

PositionAnnotation
  = "@position" _ "(" _ x:Integer _ "," _ y:Integer _ ")" {
      return { x, y };
    }

SizeAnnotation
  = "@size" _ "(" _ w:Integer _ "," _ h:Integer _ ")" {
      return { width: w, height: h };
    }

Annotations
  = pos:(_ PositionAnnotation)? size:(_ SizeAnnotation)? {
      return {
        position: pos ? pos[1] : null,
        size: size ? size[1] : null,
      };
    }

// ============ Class Diagram Elements ============

ClassDef
  = "class" S name:Identifier ann:Annotations _ "{" NL members:MemberLine* _ "}" {
      const attrs = [];
      const methods = [];
      for (const m of members) {
        if (!m) continue;
        if (m._memberType === 'attribute') attrs.push(m);
        else if (m._memberType === 'method') methods.push(m);
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
  = "abstract" S "class" S name:Identifier ann:Annotations _ "{" NL members:MemberLine* _ "}" {
      const attrs = [];
      const methods = [];
      for (const m of members) {
        if (!m) continue;
        if (m._memberType === 'attribute') attrs.push(m);
        else if (m._memberType === 'method') methods.push(m);
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
  = "interface" S name:Identifier ann:Annotations _ "{" NL members:MemberLine* _ "}" {
      const attrs = [];
      const methods = [];
      for (const m of members) {
        if (!m) continue;
        if (m._memberType === 'attribute') attrs.push(m);
        else if (m._memberType === 'method') methods.push(m);
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
  = "enum" S name:Identifier ann:Annotations _ "{" NL values:EnumLine* _ "}" {
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
      const attr = { name, type, visibility: vis };
      attr._memberType = 'attribute';
      return attr;
    }

MethodMember
  = vis:VisibilityMarker S name:Identifier _ "(" _ params:ParameterList _ ")" _ ":" _ ret:TypeExpr {
      const method = { name, returnType: ret, parameters: params, visibility: vis };
      method._memberType = 'method';
      return method;
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
  = [a-zA-Z0-9_\[\]<>,. ]

EnumLine
  = _ name:Identifier _ NL { return name; }
  / _ NL { return null; }

// ============ Class Diagram Relations ============

RelationDef
  = src:QuotedStringOrIdentifier _ srcMult:Multiplicity? _ rel:RelationType _ tgtMult:Multiplicity? _ tgt:QuotedStringOrIdentifier _ label:(":" _ LabelText)? {
      return {
        _nodeType: 'connector',
        id: makeId(src + '_' + tgt),
        type: rel,
        sourceId: src,
        targetId: tgt,
        sourceMultiplicity: srcMult || undefined,
        targetMultiplicity: tgtMult || undefined,
        label: label ? label[2] : undefined,
        properties: {},
      };
    }

Multiplicity
  = '"' chars:[^"]* '"' { return chars.join(''); }

RelationType
  = "<|.." { return 'realization'; }
  / "..|>" { return 'realization'; }
  / "<|--" { return 'inheritance'; }
  / "--|>" { return 'inheritance'; }
  / "o--" { return 'aggregation'; }
  / "--o" { return 'aggregation'; }
  / "*--" { return 'composition'; }
  / "--*" { return 'composition'; }
  / "..>" { return 'dependency'; }
  / ".." { return 'dependency'; }
  / "-->" { return 'directed-association'; }
  / "--" { return 'association'; }

// ============ Sequence Diagram Elements ============

LifelineDef
  = "lifeline" S name:Identifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'lifeline',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

MessageDef
  = src:QuotedStringOrIdentifier _ msgType:MessageType _ tgt:QuotedStringOrIdentifier _ ":" _ label:LabelText {
      return {
        _nodeType: 'connector',
        id: makeId(src + '_' + tgt),
        type: msgType,
        sourceId: src,
        targetId: tgt,
        label: label,
        properties: {},
      };
    }

MessageType
  = "->>" { return 'async-message'; }
  / "->" { return 'sync-message'; }
  / "-->" { return 'return-message'; }

// ============ Usecase Diagram Elements ============

ActorDef
  = "actor" S name:Identifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'actor',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

UsecaseDef
  = "usecase" S name:QuotedStringOrIdentifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'usecase',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

SystemBoundaryDef
  = "system-boundary" S name:QuotedStringOrIdentifier ann:Annotations _ "{" NL items:SystemBoundaryItem* _ "}" {
      const filtered = items.filter(Boolean);
      return {
        _nodeType: 'element',
        type: 'system-boundary',
        position: ann.position,
        size: ann.size,
        properties: { name, children: filtered },
      };
    }

SystemBoundaryItem
  = _ item:UsecaseDef _ NL { return item; }
  / _ NL { return null; }

// ============ Activity Diagram Elements ============

ActionDef
  = "action" S name:QuotedStringOrIdentifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'action',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

DecisionDef
  = "decision" S name:QuotedStringOrIdentifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'decision',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

ForkDef
  = "fork" S name:Identifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'fork',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

JoinDef
  = "join" S name:Identifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'join',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

InitialNodeDef
  = "initial-node" S name:Identifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'initial-node',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

FinalNodeDef
  = "final-node" S name:Identifier ann:Annotations {
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
  = "state" S name:QuotedStringOrIdentifier ann:Annotations !(_ "{") {
      return {
        _nodeType: 'element',
        type: 'state',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

CompositeStateDef
  = "composite-state" S name:QuotedStringOrIdentifier ann:Annotations _ "{" NL items:CompositeStateItem* _ "}" {
      const filtered = items.filter(Boolean);
      return {
        _nodeType: 'element',
        type: 'composite-state',
        position: ann.position,
        size: ann.size,
        properties: { name, children: filtered },
      };
    }

CompositeStateItem
  = _ item:(StateDef / InitialStateDef / FinalStateDef / TransitionDef) _ NL { return item; }
  / _ NL { return null; }

InitialStateDef
  = "initial-state" S name:Identifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'initial-state',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

FinalStateDef
  = "final-state" S name:Identifier ann:Annotations {
      return {
        _nodeType: 'element',
        type: 'final-state',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

// ============ State/Activity Transitions ============

TransitionDef
  = src:QuotedStringOrIdentifier _ "-->" _ tgt:QuotedStringOrIdentifier _ label:(":" _ LabelText)? {
      return {
        _nodeType: 'connector',
        id: makeId(src + '_' + tgt),
        type: 'transition',
        sourceId: src,
        targetId: tgt,
        label: label ? label[2] : undefined,
        properties: {},
      };
    }

// ============ Primitives ============

QuotedString
  = '"' chars:[^"]* '"' { return chars.join(''); }

QuotedStringOrIdentifier
  = QuotedString
  / Identifier

Identifier
  = head:[a-zA-Z_\u00C0-\u024F\uAC00-\uD7AF] tail:[a-zA-Z0-9_\u00C0-\u024F\uAC00-\uD7AF-]* { return head + tail.join(''); }

LabelText
  = chars:[^\n\r]+ { return chars.join('').trim(); }

Integer
  = digits:[0-9]+ { return parseInt(digits.join(''), 10); }

// Horizontal whitespace only (no newlines)
_ "whitespace"
  = [ \t]*

// Required horizontal whitespace (at least one space/tab)
S "required space"
  = [ \t]+

// Newline (consumes exactly one newline with optional trailing whitespace)
NL "newline"
  = "\r\n" / "\n" / "\r"

// End of line
EOL
  = _ NL
