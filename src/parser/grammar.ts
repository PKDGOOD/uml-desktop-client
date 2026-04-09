// Auto-generated: PEG grammar for UML DSL parser
// This file exports the grammar as a string so peggy can compile it at runtime
// without needing filesystem access (important for Electron renderer process).

export const grammar = `
// UML DSL Grammar for peggy
// Supports: class, sequence, usecase, activity, state diagrams

{
  function makeId(name) {
    return name.replace(/\\s+/g, '_').toLowerCase() + '_' + Math.random().toString(36).slice(2, 8);
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
  = _ header:DiagramHeader _ NL _ body:DiagramBody _ {
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

      // Resolve connector source/target names to IDs
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

DiagramBody
  = items:(BodyItem _)* { return items.map(i => i[0]).filter(Boolean); }

BodyItem
  = ClassDef
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
  / StateDef
  / CompositeStateDef
  / InitialStateDef
  / FinalStateDef
  / TransitionDef
  / RelationDef
  / NL { return null; }

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
  = "class" __ name:Identifier ann:Annotations _ "{" _ NL members:ClassMembers _ "}" _ NL? {
      const attrs = [];
      const methods = [];
      for (const m of members) {
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
  = "abstract" __ "class" __ name:Identifier ann:Annotations _ "{" _ NL members:ClassMembers _ "}" _ NL? {
      const attrs = [];
      const methods = [];
      for (const m of members) {
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
  = "interface" __ name:Identifier ann:Annotations _ "{" _ NL members:ClassMembers _ "}" _ NL? {
      const attrs = [];
      const methods = [];
      for (const m of members) {
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
  = "enum" __ name:Identifier ann:Annotations _ "{" _ NL values:EnumValues _ "}" _ NL? {
      return {
        _nodeType: 'element',
        type: 'enum',
        position: ann.position,
        size: ann.size,
        properties: { name, attributes: values.map(v => ({ name: v, type: '', visibility: 'public' })), methods: [] },
      };
    }

ClassMembers
  = members:(ClassMember _)* { return members.map(m => m[0]).filter(Boolean); }

ClassMember
  = MethodMember
  / AttributeMember
  / NL { return null; }

AttributeMember
  = _ vis:VisibilityMarker __ name:Identifier _ ":" _ type:TypeExpr _ NL {
      const attr = { name, type, visibility: vis };
      attr._memberType = 'attribute';
      return attr;
    }

MethodMember
  = _ vis:VisibilityMarker __ name:Identifier _ "(" _ params:ParameterList _ ")" _ ":" _ ret:TypeExpr _ NL {
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
  = chars:TypeChar+ { return chars.join(''); }

TypeChar
  = [a-zA-Z0-9_\\[\\]<>,. ]

EnumValues
  = values:(EnumValue _)* { return values.map(v => v[0]).filter(Boolean); }

EnumValue
  = _ name:Identifier _ NL { return name; }
  / NL { return null; }

// ============ Class Diagram Relations ============

RelationDef
  = src:Identifier _ srcMult:Multiplicity? _ rel:RelationType _ tgtMult:Multiplicity? _ tgt:Identifier _ label:(":" _ LabelText)? _ NL {
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
  = "lifeline" __ name:Identifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'lifeline',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

MessageDef
  = src:Identifier _ msgType:MessageType _ tgt:Identifier _ ":" _ label:LabelText _ NL {
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
  = "actor" __ name:Identifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'actor',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

UsecaseDef
  = "usecase" __ name:QuotedStringOrIdentifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'usecase',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

SystemBoundaryDef
  = "system-boundary" __ name:QuotedStringOrIdentifier ann:Annotations _ "{" _ NL items:SystemBoundaryItems _ "}" _ NL? {
      return {
        _nodeType: 'element',
        type: 'system-boundary',
        position: ann.position,
        size: ann.size,
        properties: { name, children: items },
      };
    }

SystemBoundaryItems
  = items:(SystemBoundaryItem _)* { return items.map(i => i[0]).filter(Boolean); }

SystemBoundaryItem
  = UsecaseDef
  / NL { return null; }

// ============ Activity Diagram Elements ============

ActionDef
  = "action" __ name:QuotedStringOrIdentifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'action',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

DecisionDef
  = "decision" __ name:QuotedStringOrIdentifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'decision',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

ForkDef
  = "fork" __ name:Identifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'fork',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

JoinDef
  = "join" __ name:Identifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'join',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

InitialNodeDef
  = "initial-node" __ name:Identifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'initial-node',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

FinalNodeDef
  = "final-node" __ name:Identifier ann:Annotations _ NL {
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
  = "state" __ name:QuotedStringOrIdentifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'state',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

CompositeStateDef
  = "composite-state" __ name:QuotedStringOrIdentifier ann:Annotations _ "{" _ NL items:CompositeStateItems _ "}" _ NL? {
      return {
        _nodeType: 'element',
        type: 'composite-state',
        position: ann.position,
        size: ann.size,
        properties: { name, children: items },
      };
    }

CompositeStateItems
  = items:(CompositeStateItem _)* { return items.map(i => i[0]).filter(Boolean); }

CompositeStateItem
  = StateDef
  / InitialStateDef
  / FinalStateDef
  / TransitionDef
  / NL { return null; }

InitialStateDef
  = "initial-state" __ name:Identifier ann:Annotations _ NL {
      return {
        _nodeType: 'element',
        type: 'initial-state',
        position: ann.position,
        size: ann.size,
        properties: { name },
      };
    }

FinalStateDef
  = "final-state" __ name:Identifier ann:Annotations _ NL {
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
  = src:Identifier _ "-->" _ tgt:Identifier _ label:(":" _ LabelText)? _ NL {
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
  = head:[a-zA-Z_\\u00C0-\\u024F\\uAC00-\\uD7AF] tail:[a-zA-Z0-9_\\u00C0-\\u024F\\uAC00-\\uD7AF-]* { return head + tail.join(''); }

LabelText
  = chars:[^\\n\\r]+ { return chars.join('').trim(); }

Integer
  = digits:[0-9]+ { return parseInt(digits.join(''), 10); }

// Whitespace (no newlines)
_ "whitespace"
  = [ \\t]*

// Required whitespace (no newlines)
__ "required whitespace"
  = [ \\t]+

// Newline
NL "newline"
  = ("\\r\\n" / "\\n" / "\\r")+
  / !. // end of input
`;
