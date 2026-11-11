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

  function classifierProperties(name, visibility, stereotype, rest) {
    const properties = { name };
    if (stereotype) properties.stereotype = stereotype;
    if (visibility) properties.visibility = visibility;
    return Object.assign(properties, rest);
  }

  // ---- Source spans (A04.01, ADR 0002 §5) ----
  // Half-open [start, end) UTF-16 offsets into the parsed text, as editors use.
  function spanOf(loc) {
    return { start: loc.start.offset, end: loc.end.offset };
  }

  // A span that stops before trailing whitespace the rule consumed (labels and types are trimmed too).
  function trimmedSpan(loc, matched) {
    return { start: loc.start.offset, end: loc.start.offset + matched.trimEnd().length };
  }

  function element(type, nameTok, ann, properties, loc, extra) {
    const spans = {
      declaration: spanOf(loc),
      name: nameTok.span,
      posInsertAt: ann.insertAt,
      sizeInsertAt: ann.posSpan ? ann.posSpan.end : ann.insertAt,
    };
    if (ann.posSpan) spans.pos = ann.posSpan;
    if (ann.sizeSpan) spans.size = ann.sizeSpan;
    if (extra && extra.members) spans.members = extra.members;
    if (extra && extra.closeBrace !== undefined) spans.closeBrace = extra.closeBrace;
    const node = {
      _nodeType: 'element',
      type,
      position: ann.position,
      size: ann.size,
      properties,
      _spans: spans,
    };
    if (extra && extra.children) node.children = extra.children;
    return node;
  }

  function connector(type, src, tgt, loc, matched, rest) {
    const spans = { line: trimmedSpan(loc, matched), source: src.span, target: tgt.span };
    if (rest.labelSpan) spans.label = rest.labelSpan;
    if (rest.sourceMultiplicitySpan) spans.sourceMultiplicity = rest.sourceMultiplicitySpan;
    if (rest.targetMultiplicitySpan) spans.targetMultiplicity = rest.targetMultiplicitySpan;
    const node = {
      _nodeType: 'connector',
      id: makeId('conn'),
      type,
      sourceId: src.value,
      targetId: tgt.value,
    };
    if ('sourceMultiplicity' in rest) node.sourceMultiplicity = rest.sourceMultiplicity;
    if ('targetMultiplicity' in rest) node.targetMultiplicity = rest.targetMultiplicity;
    if ('label' in rest) node.label = rest.label;
    node.properties = {};
    node._spans = spans;
    return node;
  }

  // Members in source order, with where each one lands in the model.
  function classifierMembers(members) {
    const attrs = [];
    const methods = [];
    const spans = [];
    for (const m of members) {
      if (!m) continue;
      if (m._memberType === 'method') {
        spans.push({ kind: 'method', index: methods.length, span: m.span });
        methods.push({ name: m.name, returnType: m.returnType, parameters: m.parameters, visibility: m.visibility });
      } else {
        spans.push({ kind: 'attribute', index: attrs.length, span: m.span });
        attrs.push({ name: m.name, type: m.type, visibility: m.visibility });
      }
    }
    return { attrs, methods, spans };
  }

  function defaultPos(index) {
    return { x: 50 + (index % 4) * 250, y: 50 + Math.floor(index / 4) * 200 };
  }
}

// ============ Top-level ============

Diagram
  = (_ NL)* _ header:DiagramHeader _ NL* body:BodyItem* _ {
      const elements = [];
      const elementSpans = [];
      const connectors = [];
      let elementIndex = 0;
      const nameToId = new Map();

      function addElement(item, parentId) {
        if (!item) return;
        const pos = item.position || defaultPos(elementIndex);
        const size = item.size || defaultSize(item.type);
        const id = makeId(item.type);
        nameToId.set(item.properties.name, id);
        elementSpans.push(item._spans);
        elements.push({
          id,
          type: item.type,
          position: pos,
          size: size,
          properties: item.properties,
          ...(parentId ? { parentId } : {}),
        });
        elementIndex++;
        // Children (system-boundary, composite-state) are flattened but keep an explicit parent.
        if (item.children) {
          for (const child of item.children) {
            if (child._nodeType === 'connector') connectors.push(child);
            else addElement(child, id);
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
        // A Map, so names such as __proto__ resolve like any other.
        if (nameToId.has(conn.sourceId)) conn.sourceId = nameToId.get(conn.sourceId);
        if (nameToId.has(conn.targetId)) conn.targetId = nameToId.get(conn.targetId);
        delete conn._nodeType;
      }
      const connectorSpans = connectors.map((conn) => {
        const spans = conn._spans;
        delete conn._spans;
        return spans;
      });

      const diagram = {
        id: makeId('diagram'),
        name: header.name,
        type: header.type,
        elements,
        connectors,
        viewport: { x: 0, y: 0, zoom: 1.0 },
      };
      return {
        diagram,
        spans: {
          header: header.span,
          headerName: header.nameSpan,
          lineEnding: /\r\n/.test(input) ? '\r\n' : /\r/.test(input) ? '\r' : '\n',
          elements: elementSpans,
          connectors: connectorSpans,
        },
      };
    }

DiagramHeader
  = "@class-diagram" _ name:NameQuoted { return { type: 'class', name: name.value, nameSpan: name.span, span: spanOf(location()) }; }
  / "@sequence-diagram" _ name:NameQuoted { return { type: 'sequence', name: name.value, nameSpan: name.span, span: spanOf(location()) }; }
  / "@usecase-diagram" _ name:NameQuoted { return { type: 'usecase', name: name.value, nameSpan: name.span, span: spanOf(location()) }; }
  / "@activity-diagram" _ name:NameQuoted { return { type: 'activity', name: name.value, nameSpan: name.span, span: spanOf(location()) }; }
  / "@state-diagram" _ name:NameQuoted { return { type: 'state', name: name.value, nameSpan: name.span, span: spanOf(location()) }; }

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
      return { value: { x, y }, span: spanOf(location()) };
    }

SizeAnnotation
  = "@size" _ "(" _ w:Integer _ "," _ h:Integer _ ")" {
      return { value: { width: w, height: h }, span: spanOf(location()) };
    }

// insertAt: where a missing @pos goes (after the name, or after its stereotype).
Annotations
  = pos:(_ PosAnnotation)? size:(_ SizeAnnotation)? {
      return {
        position: pos ? pos[1].value : null,
        size: size ? size[1].value : null,
        posSpan: pos ? pos[1].span : undefined,
        sizeSpan: size ? size[1].span : undefined,
        insertAt: location().start.offset,
      };
    }

// ============ Class Diagram Elements ============

ClassDef
  = vis:ElementVisibility? "class" S name:NameToken stereo:StereotypeAnnotation? ann:Annotations _ "{" _ NL members:MemberLine* _ close:CloseBrace {
      const m = classifierMembers(members);
      return element('class', name, ann, classifierProperties(name.value, vis, stereo, { attributes: m.attrs, methods: m.methods }), location(), { members: m.spans, closeBrace: close });
    }

AbstractClassDef
  = vis:ElementVisibility? "abstract" S "class" S name:NameToken stereo:StereotypeAnnotation? ann:Annotations _ "{" _ NL members:MemberLine* _ close:CloseBrace {
      const m = classifierMembers(members);
      return element('abstract-class', name, ann, classifierProperties(name.value, vis, stereo, { attributes: m.attrs, methods: m.methods }), location(), { members: m.spans, closeBrace: close });
    }

InterfaceDef
  = vis:ElementVisibility? "interface" S name:NameToken stereo:StereotypeAnnotation? ann:Annotations _ "{" _ NL members:MemberLine* _ close:CloseBrace {
      const m = classifierMembers(members);
      return element('interface', name, ann, classifierProperties(name.value, vis, stereo, { attributes: m.attrs, methods: m.methods }), location(), { members: m.spans, closeBrace: close });
    }

EnumDef
  = vis:ElementVisibility? "enum" S name:NameToken stereo:StereotypeAnnotation? ann:Annotations _ "{" _ NL values:EnumLine* _ close:CloseBrace {
      const filtered = values.filter(Boolean);
      return element('enum', name, ann,
        classifierProperties(name.value, vis, stereo, { attributes: filtered.map(v => ({ name: v.name, type: '', visibility: 'public' })), methods: [] }),
        location(),
        { members: filtered.map((v, index) => ({ kind: 'attribute', index, span: v.span })), closeBrace: close });
    }

// Optional element visibility before the keyword, e.g. `- class Order { ... }`
ElementVisibility
  = vis:VisibilityMarker S { return vis; }

// Optional stereotype after the name, e.g. `class Order <<entity>> { ... }`
StereotypeAnnotation
  = _ "<<" chars:$[^>\r\n]+ ">>" { return chars.trim(); }

MemberLine
  = _ m:(MethodMember / AttributeMember) _ NL { return m; }
  / _ NL { return null; }

AttributeMember
  = vis:VisibilityMarker S name:Identifier _ ":" _ type:TypeExpr {
      return { _memberType: 'attribute', name, type, visibility: vis, span: trimmedSpan(location(), text()) };
    }

MethodMember
  = vis:VisibilityMarker S name:Identifier _ "(" _ params:ParameterList _ ")" _ ":" _ ret:TypeExpr {
      return { _memberType: 'method', name, returnType: ret, parameters: params, visibility: vis, span: trimmedSpan(location(), text()) };
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
  = _ name:EnumValue _ NL { return name; }
  / _ NL { return null; }

EnumValue
  = name:Identifier { return { name, span: spanOf(location()) }; }

// The offset of a block's closing brace, where a first member or child goes.
CloseBrace
  = "}" { return location().start.offset; }

// ============ Class Diagram Relations ============

RelationDef
  = src:NameToken _ srcMult:Multiplicity? _ rel:RelationType _ tgtMult:Multiplicity? _ tgt:NameToken label:(_ ":" _ LabelToken)? {
      return connector(rel, src, tgt, location(), text(), {
        // An empty "" is the placeholder the serializer writes to keep the arrow direction, not a multiplicity.
        sourceMultiplicity: srcMult && srcMult.value ? srcMult.value : undefined,
        targetMultiplicity: tgtMult && tgtMult.value ? tgtMult.value : undefined,
        label: label ? label[3].value : undefined,
        sourceMultiplicitySpan: srcMult ? srcMult.span : undefined,
        targetMultiplicitySpan: tgtMult ? tgtMult.span : undefined,
        labelSpan: label ? label[3].span : undefined,
      });
    }

Multiplicity
  = m:MultiplicityToken _ { return m; }

MultiplicityToken
  = '"' chars:[^"]* '"' { return { value: chars.join(''), span: spanOf(location()) }; }

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
  = "lifeline" S name:NameToken ann:Annotations {
      return element('lifeline', name, ann, { name: name.value }, location());
    }

MessageDef
  = src:NameToken _ msgType:MessageType _ tgt:NameToken _ ":" _ label:LabelToken {
      return connector(msgType, src, tgt, location(), text(), { label: label.value, labelSpan: label.span });
    }

MessageType
  = "->>" { return 'async-message'; }
  / "<--" { return 'return-message'; }
  / "->" { return 'sync-message'; }

// ============ Usecase Diagram Elements ============

ActorDef
  = "actor" S name:NameToken ann:Annotations {
      return element('actor', name, ann, { name: name.value }, location());
    }

UsecaseDef
  = "usecase" S name:NameToken ann:Annotations {
      return element('usecase', name, ann, { name: name.value }, location());
    }

SystemBoundaryDef
  = "system-boundary" S name:NameToken ann:Annotations _ "{" _ NL items:SystemBoundaryItem* _ close:CloseBrace {
      return element('system-boundary', name, ann, { name: name.value }, location(), { children: items.filter(Boolean), closeBrace: close });
    }

SystemBoundaryItem
  = _ item:UsecaseDef _ NL { return item; }
  / _ NL { return null; }

UsecaseRelationDef
  = src:NameToken _ ("-->" / "..>") _ tgt:NameToken _ stereotype:UsecaseStereotype {
      return connector(stereotype, src, tgt, location(), text(), {});
    }

UsecaseStereotype
  = "<<include>>" { return 'include'; }
  / "<<extend>>" { return 'extend'; }

// ============ Activity Diagram Elements ============

ActionDef
  = "action" S name:NameToken ann:Annotations {
      return element('action', name, ann, { name: name.value }, location());
    }

DecisionDef
  = "decision" S name:NameToken ann:Annotations {
      return element('decision', name, ann, { name: name.value }, location());
    }

ForkDef
  = "fork" S name:NameToken ann:Annotations {
      return element('fork', name, ann, { name: name.value }, location());
    }

JoinDef
  = "join" S name:NameToken ann:Annotations {
      return element('join', name, ann, { name: name.value }, location());
    }

InitialNodeDef
  = "initial-node" S name:NameToken ann:Annotations {
      return element('initial-node', name, ann, { name: name.value }, location());
    }

FinalNodeDef
  = "final-node" S name:NameToken ann:Annotations {
      return element('final-node', name, ann, { name: name.value }, location());
    }

// ============ State Diagram Elements ============

StateDef
  = "state" S name:NameToken ann:Annotations !(_ "{") {
      return element('state', name, ann, { name: name.value }, location());
    }

CompositeStateDef
  = "composite-state" S name:NameToken ann:Annotations _ "{" _ NL items:CompositeStateItem* _ close:CloseBrace {
      return element('composite-state', name, ann, { name: name.value }, location(), { children: items.filter(Boolean), closeBrace: close });
    }

CompositeStateItem
  = _ item:(StateDef / InitialStateDef / FinalStateDef / TransitionDef) _ NL { return item; }
  / _ NL { return null; }

InitialStateDef
  = "initial-state" S name:NameToken ann:Annotations {
      return element('initial-state', name, ann, { name: name.value }, location());
    }

FinalStateDef
  = "final-state" S name:NameToken ann:Annotations {
      return element('final-state', name, ann, { name: name.value }, location());
    }

// ============ Transitions (activity + state) ============

TransitionDef
  = src:NameToken _ "-->" _ tgt:NameToken label:(_ ":" _ LabelToken)? {
      return connector('transition', src, tgt, location(), text(), {
        label: label ? label[3].value : undefined,
        labelSpan: label ? label[3].span : undefined,
      });
    }

// ============ Primitives ============

QuotedString
  = '"' ("\\" . / [^"\\])* '"' { return JSON.parse(text()); }

IdentifierOrQuoted
  = QuotedString
  / Identifier

// A name with its span, quotes included.
NameToken
  = value:IdentifierOrQuoted { return { value, span: spanOf(location()) }; }

NameQuoted
  = value:QuotedString { return { value, span: spanOf(location()) }; }

Identifier
  = head:[a-zA-Z_\u00C0-\u024F\uAC00-\uD7AF] tail:[a-zA-Z0-9_\u00C0-\u024F\uAC00-\uD7AF]* { return head + tail.join(''); }

// A label: the rest of the line, trimmed, with the span of the trimmed text.
LabelToken
  = raw:$[^\n\r]+ {
      const lead = raw.length - raw.trimStart().length;
      const value = raw.trim();
      const start = location().start.offset + lead;
      return { value, span: { start, end: start + value.length } };
    }

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
