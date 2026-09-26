"use strict";
/* ============================================================
   ScriptUI Dialog Designer — site autonome (aucune dépendance)
   Générateur d'interfaces ExtendScript pour les applications Adobe
   (Photoshop, Illustrator, InDesign, After Effects, Bridge).
   ============================================================ */
var APP_VERSION = "5.9.13";

/* ---------- applications cibles ----------
   target : valeur de la directive #target (null = aucune)
   undo   : regroupement d'annulation disponible ("ae", "ps", "id" ou null)
   engine : les palettes ont besoin d'un moteur persistant (#targetengine)
   paletteCloses : la palette se ferme dès la fin du script (Photoshop) */
var TARGET_APPS = {
  generic:      {label:"Générique (toutes les applis)", target:null,          undo:null, engine:false, paletteCloses:false, brandBg:"#2A2A2A", brandFg:"#D8D8D8"},
  photoshop:    {label:"Photoshop",                     target:"photoshop",   undo:"ps", engine:false, paletteCloses:true,  brandBg:"#001E36", brandFg:"#31A8FF"},
  illustrator:  {label:"Illustrator",                   target:"illustrator", undo:null, engine:true,  paletteCloses:false, brandBg:"#330000", brandFg:"#FF9A00"},
  indesign:     {label:"InDesign",                      target:"indesign",    undo:"id", engine:true,  paletteCloses:false, brandBg:"#49021F", brandFg:"#FF3366"},
  aftereffects: {label:"After Effects",                 target:"aftereffects",undo:"ae", engine:false, paletteCloses:false, brandBg:"#00005B", brandFg:"#9999FF"},
  bridge:       {label:"Bridge",                        target:"bridge",      undo:null, engine:true,  paletteCloses:false, brandBg:"#000B1D", brandFg:"#FFFFFF"}
};
function hexToRgba(hex,a){
  var m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex||"");
  return m ? "rgba("+parseInt(m[1],16)+","+parseInt(m[2],16)+","+parseInt(m[3],16)+","+a+")" : "rgba(216,216,216,"+a+")";
}
function targetOf(p){ return TARGET_APPS[p.targetApp] || TARGET_APPS.generic; }
/* rappels propres à chaque application (encadré de l'inspecteur) */
var TARGET_NOTES = {
  generic:     "<li><b>Générique</b> : pas de <code>#target</code> ni de regroupement d'annulation ; choisissez l'appli pour un code adapté.</li>",
  photoshop:   "<li><b>Photoshop</b> : préférez <b>dialog</b> — une palette se ferme à la fin du script. Annulation groupée via <code>suspendHistory</code>.</li>",
  illustrator: "<li><b>Illustrator</b> : les palettes utilisent <code>#targetengine main</code> (ajouté automatiquement). Pas d'annulation groupée native.</li>",
  indesign:    "<li><b>InDesign</b> : palettes via <code>#targetengine</code> (automatique). Annulation groupée via <code>app.doScript(… UndoModes.ENTIRE_SCRIPT)</code>.</li>",
  aftereffects:"<li><b>After Effects</b> : <b>dockable</b> = <code>thisObj instanceof Panel</code>, fichier dans <i>ScriptUI Panels</i>. Annulation via <code>beginUndoGroup</code>.</li>",
  bridge:      "<li><b>Bridge</b> : palettes via <code>#targetengine</code> (automatique). Pas d'annulation groupée.</li>"
};
var TARGET_OPTIONS = Object.keys(TARGET_APPS).map(function(k){ return [k,TARGET_APPS[k].label]; });
/* nom de moteur #targetengine propre au script (évite les collisions entre scripts) */
function engineName(p){ return (p.title||"MonScript").replace(/[^\w]/g,"") || "MonScript"; }
var SAVE_KEY = "scriptui-dialog-designer:autosave";
var LEGACY_SAVE_KEY = "scriptui-designer:autosave";          // v4–v5.9.12 : relu une fois pour récupérer le travail
var MODEL_MARKER = "// @scriptui-dialog-designer ";
var LEGACY_MODEL_MARKER = "// @scriptui-designer ";           // .jsx exportés avant le changement de nom : toujours réimportables

/* ---------- mots réservés ES3 (ne peuvent pas être des variables) ---------- */
var RESERVED = {};
("abstract boolean break byte case catch char class const continue debugger default delete do double else enum export "
+"extends false final finally float for function goto if implements import in instanceof int interface long native new "
+"null package private protected public return short static super switch synchronized this throw throws transient true "
+"try typeof var void volatile while with").split(" ").forEach(function(w){ RESERVED[w]=true; });

var __uid = 1;
function uid(){ return "n"+(__uid++)+"_"+Math.random().toString(36).slice(2,6); }

var CONTAINER_TYPES = ["root","group","panel","tab"];
var ALIGN_SELF = ["","left","center","right","top","bottom","fill"];

var CONTROL_DEFS = {
  group:{label:"Group",icon:"▣",container:true,defaults:{orientation:"row",alignChildren:"center",spacing:10,margins:0}},
  panel:{label:"Panel",icon:"◫",container:true,defaults:{text:"Panneau",orientation:"column",alignChildren:"left",spacing:10,margins:12,alignment:"fill",borderStyle:"etched"}},
  tabbedpanel:{label:"TabbedPanel",icon:"⧉",container:true,defaults:{selection:0,alignment:"fill",name:""}},
  verticaltabbedpanel:{label:"VerticalTabs",icon:"☰",container:true,defaults:{selection:0,tabNavWidth:0,alignment:"fill",name:""}},
  tab:{label:"Tab",icon:"▤",container:true,defaults:{text:"Onglet",orientation:"column",alignChildren:"left",spacing:10,margins:12}},
  statictext:{label:"StaticText",icon:"T",defaults:{text:"Libellé :",multiline:false,splitLines:false,justify:"left",truncate:"none"}},
  edittext:{label:"EditText",icon:"⌨",defaults:{text:"",characters:20,multiline:false,readonly:false,noecho:false,justify:"left",active:false,
    enterKeySignalsOnChange:false,wantReturn:false,name:""}},
  button:{label:"Button",icon:"⏺",defaults:{text:"Bouton",active:false,name:""}},
  iconbutton:{label:"IconButton",icon:"▩",defaults:{imageData:"",imageName:"",imagePath:"~/Desktop/icone.png",style:"button",toggle:false,name:"",width:0,height:0}},
  image:{label:"Image",icon:"▨",defaults:{imageData:"",imageName:"",imagePath:"~/Desktop/logo.png",width:0,height:0}},
  checkbox:{label:"Checkbox",icon:"☑",defaults:{text:"Option",value:true,name:""}},
  radiobutton:{label:"RadioButton",icon:"◉",defaults:{text:"Choix",value:false,name:""}},
  dropdownlist:{label:"DropdownList",icon:"▾",defaults:{items:"Option A, Option B, -, Option C",selection:0,name:""}},
  listbox:{label:"ListBox",icon:"≡",defaults:{items:"Élément 1, Élément 2, Élément 3",multiselect:false,numberOfColumns:1,showHeaders:false,columnTitles:"Colonne 1, Colonne 2",columnWidths:"",selection:0,name:"",alignment:"fill",height:80}},
  treeview:{label:"TreeView",icon:"⌥",container:true,defaults:{items:"Compositions: Intro | Générique, Solides: Fond, Élément simple",name:"",alignment:"fill",height:110}},
  slider:{label:"Slider",icon:"⊸",defaults:{value:50,min:0,max:100,name:"",alignment:"fill"}},
  scrollbar:{label:"Scrollbar",icon:"⇕",defaults:{value:30,min:0,max:100,stepdelta:1,name:"",alignment:"fill"}},
  progressbar:{label:"Progressbar",icon:"▬",defaults:{value:40,max:100,alignment:"fill"}},
  divider:{label:"Divider ―",icon:"―",defaults:{alignment:"fill",width:0}},
  dividerv:{label:"Divider │",icon:"│",defaults:{alignment:"fill",height:0}},
  treeitem:{label:"TreeItem",icon:"•",container:true,defaults:{text:"Élément",expanded:true,name:""}},
  custom:{label:"Custom (onDraw)",icon:"✦",defaults:{text:"Action",name:"",width:120,height:28,
    fillColor:"#2f5fbf",hoverColor:"#4677d6",textColor:"#ffffff",clickable:true}}
};
var COMMON_DEFAULTS = {helpTip:"",enabled:true,alignment:"",alignV:"",width:0,height:0,
  minWidth:0,minHeight:0,maxWidth:0,maxHeight:0,fontStyle:"",fontSize:0,textFr:"",hidden:false};
/* types dont la police est réglable (graphics.font) */
var FONT_TYPES = {statictext:1,edittext:1,button:1,checkbox:1,radiobutton:1,panel:1,dropdownlist:1,listbox:1,custom:1};
/* "#rrggbb" → "[r, g, b, 1]" (couleurs ScriptUI : composantes 0–1) */
function rgbArray(hex){
  var m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex||""));
  if(!m) return "[0, 0, 0, 1]";
  return "["+[m[1],m[2],m[3]].map(function(x){ return Math.round(parseInt(x,16)/255*1000)/1000; }).join(", ")+", 1]";
}
/* types interactifs dont la valeur est lue par getSettings() quand ils sont nommés */
var SETTING_TYPES = {edittext:1,checkbox:1,radiobutton:1,dropdownlist:1,listbox:1,slider:1,scrollbar:1};
function isType(t){ return CONTROL_DEFS.hasOwnProperty(t); }
/* conteneurs qui n'acceptent que des Tabs (onglets horizontaux natifs, ou verticaux simulés) */
var TAB_HOSTS = {tabbedpanel:1, verticaltabbedpanel:1};
/* conteneurs qui n'acceptent que des TreeItem (le TreeView et ses nœuds) */
var TREE_HOSTS = {treeview:1, treeitem:1};
function findTreeHost(id){
  var n=findNode(S.tree,id);
  if(n&&TREE_HOSTS[n.type]) return n;
  var p=findParent(S.tree,id);
  while(p){ if(TREE_HOSTS[p.type]) return p; p=findParent(S.tree,p.id); }
  return null;
}
function findTabHost(id){
  var p=findParent(S.tree,id);
  while(p){ if(TAB_HOSTS[p.type]) return p; p=findParent(S.tree,p.id); }
  var n=findNode(S.tree,id);
  return n&&TAB_HOSTS[n.type]?n:null;
}
function isContainer(n){ return CONTAINER_TYPES.indexOf(n.type)>=0 || !!TAB_HOSTS[n.type] || !!TREE_HOSTS[n.type]; }

function assign(){ var o={},i,k; for(i=0;i<arguments.length;i++){ var s=arguments[i]||{}; for(k in s) if(s.hasOwnProperty(k)) o[k]=s[k]; } return o; }

function makeNode(type){
  var n = {id:uid(),type:type,props:assign(COMMON_DEFAULTS,CONTROL_DEFS[type].defaults)};
  if(CONTROL_DEFS[type].container) n.children=[];
  if(TAB_HOSTS[type]){
    var t1=makeNode("tab"); t1.props.text="Général";
    var t2=makeNode("tab"); t2.props.text="Avancé";
    n.children=[t1,t2];
  }
  if(type==="treeview") n.children=treeItemsFromString(CONTROL_DEFS.treeview.defaults.items);
  return n;
}
/* ancienne syntaxe texte « Nœud: enfant | enfant, Item » → TreeItem de la hiérarchie */
function treeItemsFromString(str){
  return parseTreeItems(str).map(function(e){
    var it=makeNode("treeitem");
    if(e.node){
      it.props.text=e.node;
      it.children=e.children.map(function(c){ var ch=makeNode("treeitem"); ch.props.text=c; return ch; });
    } else it.props.text=e.item;
    return it;
  });
}
function makeRoot(over){
  return {id:"root",type:"root",children:[],props:assign({
    title:"Mon Script",titleFr:"",winType:"palette",orientation:"column",alignChildren:"fill",
    targetApp:"generic",
    spacing:12,margins:14,resizeable:true,genHandlers:true,genSettings:true,persistSettings:false,localize:false,
    embedModel:true,exportShow:true,exportWrapper:true,indentSize:"4",refList:false,hiddenAsComment:false,
    closeButton:true,minimizeButton:false,maximizeButton:false,borderless:false,independent:false,su1PanelCoordinates:false
  },over)};
}

/* ---------- templates ---------- */
function tplOkCancel(){
  var root=makeRoot({title:"Mon Script",winType:"dialog"});
  var pnl=makeNode("panel"); pnl.props.text="Paramètres";
  var row=makeNode("group"); row.props.alignment="fill"; row.props.alignChildren="center";
  var lbl=makeNode("statictext"); lbl.props.text="Nom du calque :";
  var edt=makeNode("edittext"); edt.props.text="Solide 1"; edt.props.name="layerName"; edt.props.alignment="fill";
  row.children=[lbl,edt];
  var chk=makeNode("checkbox"); chk.props.text="Appliquer à la sélection"; chk.props.name="applySel";
  var dd=makeNode("dropdownlist"); dd.props.name="mode"; dd.props.alignment="fill";
  pnl.children=[row,chk,dd];
  var btns=makeNode("group"); btns.props.alignment="right";
  var cancel=makeNode("button"); cancel.props.text="Annuler"; cancel.props.name="cancel";
  var ok=makeNode("button"); ok.props.text="OK"; ok.props.name="ok";
  btns.children=[cancel,ok];
  root.children=[pnl,btns];
  return root;
}
function tplRender(){
  var root=makeRoot({title:"Traitement par lots",winType:"palette",genSettings:false});
  var st=makeNode("statictext"); st.props.text="Prêt."; st.props.name="statusText"; st.props.alignment="fill";
  var pb=makeNode("progressbar"); pb.props.value=0; pb.props.name="prog";
  var row=makeNode("group"); row.props.alignment="right";
  var b1=makeNode("button"); b1.props.text="Choisir les fichiers…"; b1.props.name="pickFiles";
  var b2=makeNode("button"); b2.props.text="Lancer"; b2.props.name="startBatch";
  row.children=[b1,b2];
  root.children=[st,pb,row];
  return root;
}
function tplDock(){
  var root=makeRoot({title:"Toolbox",winType:"dockable",targetApp:"aftereffects"});
  var tp=makeNode("tabbedpanel");
  tp.children[0].props.text="Calques";
  var b=makeNode("button"); b.props.text="Dupliquer"; b.props.name="dupLayer"; b.props.alignment="fill";
  var b2=makeNode("button"); b2.props.text="Précomposer"; b2.props.name="precompose"; b2.props.alignment="fill";
  tp.children[0].children=[b,b2];
  tp.children[1].props.text="Options";
  var chk=makeNode("checkbox"); chk.props.text="Confirmer avant action"; chk.props.name="confirmFirst";
  tp.children[1].children=[chk];
  root.children=[tp];
  return root;
}
function tplPrefs(){
  var root=makeRoot({title:"Préférences",winType:"dialog",persistSettings:true});
  var p1=makeNode("panel"); p1.props.text="Général";
  var c1=makeNode("checkbox"); c1.props.text="Ouvrir au démarrage"; c1.props.name="openAtStart";
  var c2=makeNode("checkbox"); c2.props.text="Afficher les avertissements"; c2.props.name="showWarnings";
  p1.children=[c1,c2];
  var p2=makeNode("panel"); p2.props.text="Format de sortie";
  var r1=makeNode("radiobutton"); r1.props.text="PNG"; r1.props.name="fmtPng"; r1.props.value=true;
  var r2=makeNode("radiobutton"); r2.props.text="JPEG"; r2.props.name="fmtJpeg";
  var r3=makeNode("radiobutton"); r3.props.text="PDF"; r3.props.name="fmtPdf";
  p2.children=[r1,r2,r3];
  var btns=makeNode("group"); btns.props.alignment="right";
  var cancel=makeNode("button"); cancel.props.text="Annuler"; cancel.props.name="cancel";
  var ok=makeNode("button"); ok.props.text="Enregistrer"; ok.props.name="ok";
  btns.children=[cancel,ok];
  root.children=[p1,p2,btns];
  return root;
}
function tplToolbar(){
  var root=makeRoot({title:"Outils rapides",winType:"palette",genSettings:false});
  var sec=makeNode("panel"); sec.props.text="Calques"; sec.props.borderStyle="topDivider";
  var row=makeNode("group"); row.props.alignment="fill";
  [["Centrer","center","#2f5fbf","#4677d6"],["Aligner","align","#2f8f5f","#3fae76"],["Nettoyer","clean","#9f3f3f","#bf5454"]].forEach(function(d){
    var c=makeNode("custom"); c.props.text=d[0]; c.props.name=d[1]; c.props.fillColor=d[2]; c.props.hoverColor=d[3]; c.props.width=90;
    row.children.push(c);
  });
  sec.children=[row];
  var st=makeNode("statictext"); st.props.text="Prêt — survolez un bouton pour voir sa couleur de survol en mode Test.";
  st.props.name="status"; st.props.width=280; st.props.truncate="end"; st.props.alignment="fill";
  root.children=[sec,st];
  return root;
}
var TEMPLATES=[
  {id:"okcancel",label:"Dialogue OK / Annuler",make:tplOkCancel},
  {id:"render",label:"Traitement par lots (barre de progression)",make:tplRender},
  {id:"dock",label:"Panneau ancrable à onglets (After Effects)",make:tplDock},
  {id:"prefs",label:"Préférences (persistantes)",make:tplPrefs},
  {id:"toolbar",label:"Barre d'outils (boutons Custom dessinés)",make:tplToolbar},
  {id:"blank",label:"Fenêtre vide",make:function(){return makeRoot({});}}
];

/* ---------- helpers d'arbre ---------- */
function clone(t){ return JSON.parse(JSON.stringify(t)); }
function findNode(node,id){
  if(node.id===id) return node;
  if(node.children) for(var i=0;i<node.children.length;i++){ var r=findNode(node.children[i],id); if(r) return r; }
  return null;
}
function findParent(node,id){
  if(node.children) for(var i=0;i<node.children.length;i++){
    if(node.children[i].id===id) return node;
    var r=findParent(node.children[i],id); if(r) return r;
  }
  return null;
}
function findAncestorOfType(tree,id,type){
  var cur=findNode(tree,id);
  while(cur){ if(cur.type===type) return cur; cur=findParent(tree,cur.id); }
  return null;
}
function reId(node){ node.id=uid(); if(node.children) node.children.forEach(reId); return node; }
function walk(node,fn,parent){ fn(node,parent); if(node.children) node.children.forEach(function(c){ walk(c,fn,node); }); }
/* comme walk, mais n'entre pas dans les items masqués (= ce qui sera exporté) */
function walkVisible(node,fn){ if(node.props.hidden) return; fn(node); if(node.children) node.children.forEach(function(c){ walkVisible(c,fn); }); }

/* Normalise un arbre venant d'un fichier, d'un snapshot ou de la sauvegarde auto :
   complète les propriétés manquantes, retire les types inconnus et les
   Tabs mal placés. Lève une erreur si ce n'est pas une maquette. Retourne le nombre d'items retirés. */
function sanitizeTree(t){
  if(!t||t.type!=="root"||!Array.isArray(t.children)) throw new Error("invalide");
  var removed=0;
  // maquettes antérieures à la v5 : conçues pour After Effects, elles gardent cette cible
  var legacy = !(t.props && t.props.targetApp);
  t.id="root"; t.props=assign(makeRoot({}).props,t.props);
  if(legacy) t.props.targetApp="aftereffects";
  if(!TARGET_APPS.hasOwnProperty(t.props.targetApp)) t.props.targetApp="generic";
  (function clean(node){
    node.children=node.children.filter(function(c){
      var ok = c && typeof c==="object" && isType(c.type) &&
        ((!!TAB_HOSTS[node.type]) === (c.type==="tab")) &&   // Tab ⇔ parent TabbedPanel (horizontal ou vertical)
        ((!!TREE_HOSTS[node.type]) === (c.type==="treeitem")); // TreeItem ⇔ parent TreeView / TreeItem
      if(!ok) removed++;
      return ok;
    });
    node.children.forEach(function(c){
      if(!c.id||c.id==="root") c.id=uid();
      c.props=assign(COMMON_DEFAULTS,CONTROL_DEFS[c.type].defaults,c.props);
      // TreeView d'avant la v5.8 : éléments décrits en texte → convertis en TreeItem
      if(c.type==="treeview" && !Array.isArray(c.children)) c.children=treeItemsFromString(c.props.items||"");
      if(CONTROL_DEFS[c.type].container){ if(!Array.isArray(c.children)) c.children=[]; clean(c); }
      else delete c.children;
    });
  })(t);
  return removed;
}

/* ---------- noms de variables (avec mots réservés) ---------- */
function computeNames(root){
  var used={},map={};
  walk(root,function(node){
    if(node.type==="root"){ map[node.id]="win"; used.win=true; return; }
    var base=(node.props.name||"").replace(/[^a-zA-Z0-9_]/g,"");
    if(!base) base = (node.type==="divider"||node.type==="dividerv") ? "div" : node.type.slice(0,5);
    if(!/^[a-zA-Z_]/.test(base)) base="_"+base;
    if(RESERVED[base]) base=base+"_";           // corrige "Illegal use of reserved word"
    var n=base,i=1;
    while(used[n]) n=base+(++i);
    used[n]=true; map[node.id]=n;
  });
  return map;
}

/* ---------- parsing ---------- */
function parseTreeItems(str){
  return String(str).split(",").map(function(s){return s.trim();}).filter(Boolean).map(function(entry){
    var i=entry.indexOf(":");
    if(i>=0) return {node:entry.slice(0,i).trim(),children:entry.slice(i+1).split("|").map(function(c){return c.trim();}).filter(Boolean)};
    return {item:entry};
  });
}
/* largeurs de colonnes de ListBox : "80, 120" → [80, 120] (valeurs > 0 uniquement) */
function colWidths(pr){
  if(!pr.columnWidths||(pr.numberOfColumns|0)<2) return [];
  return String(pr.columnWidths).split(",").map(function(s){ return parseInt(s,10); }).filter(function(n){ return n>0; });
}
function gridCols(pr,nCols){
  var w=colWidths(pr), cols=[];
  for(var i=0;i<nCols;i++) cols.push(w[i]?w[i]+"px":"1fr");
  return cols.join(" ");
}
function parseListRows(str){
  return String(str).split(",").map(function(s){return s.trim();}).filter(function(s){return s.length;})
    .map(function(row){ return row.split("|").map(function(c){return c.trim();}); });
}

/* ---------- validation ---------- */
function validate(tree){
  var issues=[],seen={},isDialog=tree.props.winType==="dialog",hasOk=false,hasButton=false;
  var finalNames=computeNames(tree), unnamed=[];
  walkVisible(tree,function(node){
    if(node.type==="button" && (node.props.name||"").toLowerCase()==="ok") hasOk=true;
    if(node.type==="button"||node.type==="iconbutton"||(node.type==="custom"&&node.props.clickable)) hasButton=true;
    if(SETTING_TYPES[node.type] && !node.props.name) unnamed.push(node.id);
  });
  walk(tree,function(node){
    var pr=node.props;
    if(pr.name && node.type!=="root"){
      // on valide le nom tel qu'il sortira dans le code, pas le nom saisi
      var clean=pr.name.replace(/[^a-zA-Z0-9_]/g,""), fin=finalNames[node.id];
      if(clean && seen[clean]){
        issues.push({id:node.id,fields:["name"],level:"err",msg:"Nom en double : « "+pr.name+" » et « "+seen[clean]+" » donnent la même variable — renommé en « "+fin+" »"});
      } else if(!clean){
        issues.push({id:node.id,fields:["name"],level:"warn",msg:"« "+pr.name+" » ne contient aucun caractère valide (a-z, 0-9, _) — variable « "+fin+" »"});
      } else if(fin!==pr.name){
        var why = RESERVED[clean] ? "mot réservé ExtendScript"
          : /^[0-9]/.test(clean) ? "commence par un chiffre"
          : clean!==pr.name ? "caractères non autorisés (accents, espaces…)"
          : "nom déjà pris par win ou une variable automatique";
        issues.push({id:node.id,fields:["name"],level:"warn",msg:"« "+pr.name+" » devient « "+fin+" » dans le code ("+why+")"});
      }
      if(clean && !seen[clean]) seen[clean]=pr.name;
    }
    if(node.type==="dropdownlist"){
      var ddItems=String(pr.items).split(","), n=ddItems.length, ds=pr.selection|0;
      if(ds>=n||ds<0) issues.push({id:node.id,fields:["selection","items"],level:"err",msg:"DropdownList : selection ("+pr.selection+") hors bornes (0–"+(n-1)+")"});
      else if(ddItems[ds].trim()==="-") issues.push({id:node.id,fields:["selection","items"],level:"err",msg:"DropdownList : selection ("+ds+") pointe sur un séparateur « - »"});
    }
    if(TAB_HOSTS[node.type]){
      if(!node.children.length) issues.push({id:node.id,level:"err",msg:"TabbedPanel sans onglet : ajoutez au moins un Tab"});
      else if((pr.selection|0)>=node.children.length) issues.push({id:node.id,fields:["selection"],level:"err",msg:"TabbedPanel : selection ("+pr.selection+") hors bornes"});
    }
    if(node.type==="edittext"&&pr.multiline&&pr.noecho) issues.push({id:node.id,fields:["multiline","noecho"],level:"warn",msg:"EditText : multiline + noecho non supporté"});
    if(node.type==="edittext"&&pr.wantReturn&&!pr.multiline) issues.push({id:node.id,fields:["wantReturn","multiline"],level:"warn",msg:"EditText : wantReturn n'a d'effet qu'en multiligne"});
    if(node.type==="edittext"&&pr.multiline&&pr.justify&&pr.justify!=="left"&&tree.props.targetApp==="photoshop")
      issues.push({id:node.id,fields:["justify","multiline"],level:"warn",msg:"Photoshop : EditText multiligne + justify « "+pr.justify+" » peut faire échouer le script — gardez « left »"});
    if(node.type==="statictext"&&pr.splitLines&&!pr.multiline) issues.push({id:node.id,fields:["splitLines","multiline"],level:"info",msg:"StaticText : le découpage en lignes ne s'applique qu'en multiligne"});
    if(node.type==="statictext"&&pr.truncate&&pr.truncate!=="none"&&pr.multiline) issues.push({id:node.id,fields:["truncate","multiline"],level:"warn",msg:"StaticText : truncate est ignoré en multiligne"});
    if(node.type==="custom"&&(!(pr.width>0)||!(pr.height>0))) issues.push({id:node.id,fields:["size"],level:"err",msg:"Custom : largeur et hauteur obligatoires (sinon rien n'est dessiné)"});
    if(node.type==="image"||node.type==="iconbutton"){
      var lbl=CONTROL_DEFS[node.type].label;
      if(!pr.imageData)
        issues.push({id:node.id,fields:["imageData","imagePath"],level:"info",msg:lbl+" : image non intégrée — le script devra trouver « "+pr.imagePath+" » sur le disque"});
      else {
        var kb=Math.round(imageBytes(pr.imageData)/1024);
        if(kb>150) issues.push({id:node.id,fields:["imageData"],level:"warn",msg:lbl+" : image lourde ("+kb+" Ko) — le .jsx grossit d'environ "+Math.round(kb*2.5)+" Ko ; réduisez-la"});
        if(/^data:image\/jpeg/.test(pr.imageData) && tree.props.targetApp==="photoshop")
          issues.push({id:node.id,fields:["imageData"],level:"warn",msg:lbl+" : certaines versions de Photoshop n'affichent pas les JPEG intégrés — préférez un PNG"});
      }
    }
    if(node.type==="listbox"&&(pr.numberOfColumns|0)>1&&pr.showHeaders){
      var titles=String(pr.columnTitles).split(",").map(function(s){return s.trim();}).filter(Boolean);
      if(titles.length!==(pr.numberOfColumns|0)) issues.push({id:node.id,fields:["columnTitles","numberOfColumns"],level:"warn",msg:"ListBox : "+titles.length+" titre(s) pour "+pr.numberOfColumns+" colonnes"});
    }
    if(node.type==="listbox"&&(pr.numberOfColumns|0)>1&&colWidths(pr).length&&colWidths(pr).length!==(pr.numberOfColumns|0))
      issues.push({id:node.id,fields:["columnWidths","numberOfColumns"],level:"warn",msg:"ListBox : "+colWidths(pr).length+" largeur(s) pour "+pr.numberOfColumns+" colonnes"});
    if(node.type==="divider"||node.type==="dividerv"){
      var par=findParent(tree,node.id);
      if(par){
        var ori = par.props.orientation;
        if(node.type==="divider" && ori==="row")
          issues.push({id:node.id,level:"warn",msg:"Divider horizontal dans un conteneur en « row » : utilisez le Divider vertical (│)"});
        if(node.type==="dividerv" && ori==="column")
          issues.push({id:node.id,level:"warn",msg:"Divider vertical dans un conteneur en « column » : utilisez le Divider horizontal (―)"});
      }
    }
    if(node.children){
      var radios=node.children.filter(function(c){return c.type==="radiobutton";});
      if(radios.length>=2 && !radios.some(function(r){return r.props.value;}))
        issues.push({id:node.id,level:"warn",msg:"Groupe de RadioButtons : aucun sélectionné par défaut"});
    }
  });
  if(isDialog&&!hasOk) issues.push({id:"root",fields:["winType"],level:"warn",msg:"Dialogue sans bouton nommé « ok » (visible) : ENTRÉE ne validera pas"});
  var noClose = tree.props.winType!=="dockable" && (tree.props.borderless || tree.props.closeButton===false);
  if(noClose && !hasButton) issues.push({id:"root",fields:["closeButton","borderless"],level:"warn",msg:"Fenêtre sans bouton de fermeture ni bouton dans l'interface : l'utilisateur ne pourra pas la fermer"});
  // pièges propres à l'application cible
  var app=tree.props.targetApp, wt=tree.props.winType, floating=(wt==="palette"||wt==="window");
  if(wt==="dockable" && app!=="aftereffects" && app!=="generic")
    issues.push({id:"root",fields:["winType","targetApp"],level:"err",msg:"Panneau ancrable (dockable) : n'existe que dans After Effects — choisissez palette ou dialog pour "+TARGET_APPS[app].label});
  else if(wt==="dockable" && app==="generic")
    issues.push({id:"root",fields:["winType","targetApp"],level:"warn",msg:"Panneau ancrable : ancré seulement dans After Effects ; ailleurs il s'ouvre comme une palette"});
  if(floating && app==="photoshop")
    issues.push({id:"root",fields:["winType"],level:"warn",msg:"Photoshop CC : la doc Adobe indique que palette et window ne sont pas pris en charge (la fenêtre se ferme à la fin du script ; au mieux une barre de progression pendant un traitement) — utilisez dialog"});
  if(tree.props.su1PanelCoordinates && app!=="photoshop" && app!=="generic")
    issues.push({id:"root",fields:["su1PanelCoordinates","targetApp"],level:"info",msg:"su1PanelCoordinates n'a d'effet que dans Photoshop"});
  if(tree.props.independent && wt!=="window")
    issues.push({id:"root",fields:["independent","winType"],level:"info",msg:"independent ne s'applique qu'au type « window » (ignoré ici)"});
  if(floating && app==="generic")
    issues.push({id:"root",fields:["targetApp"],level:"info",msg:"Palette en mode Générique : selon l'appli elle se ferme à la fin du script (Photoshop) ou exige #targetengine (Illustrator, InDesign, Bridge) — choisissez l'application cible"});
  if(tree.props.genSettings && unnamed.length)
    issues.push({id:unnamed[0],fields:["name"],level:"info",msg:unnamed.length+" contrôle(s) interactif(s) sans nom : absent(s) de getSettings()"});
  return issues;
}

/* ---------- génération ExtendScript ---------- */
function escNl(s){ return s.replace(/\r\n?|\n/g,"\\n"); }
function esc(s){ return escNl(String(s==null?"":s).replace(/\\/g,"\\\\").replace(/"/g,'\\"')); }
function escQ(s){ return escNl(String(s==null?"":s).replace(/\\/g,"\\\\").replace(/'/g,"\\'")); }

/* alignment ScriptUI : chaîne simple, ou tableau [horizontal, vertical] si alignV est renseigné */
var ALIGN_H = ["left","center","right","fill"];
function alignValue(pr,quote){
  var q=quote||'"';
  if(pr.alignV){
    var hz = ALIGN_H.indexOf(pr.alignment)>=0 ? pr.alignment : "left";
    return "["+q+hz+q+", "+q+pr.alignV+q+"]";
  }
  return pr.alignment ? q+pr.alignment+q : "";
}

/* ligne finale du .jsx : la maquette, pour pouvoir réimporter le fichier */
function modelLine(root){
  return MODEL_MARKER+JSON.stringify({app:"scriptui-dialog-designer",version:APP_VERSION,tree:root});
}
function extractModel(text){
  // marqueur actuel, sinon celui des .jsx exportés avant le changement de nom
  var marker=MODEL_MARKER, i=text.lastIndexOf(marker);
  if(i<0){ marker=LEGACY_MODEL_MARKER; i=text.lastIndexOf(marker); }
  if(i<0) return null;
  var end=text.indexOf("\n",i);
  return JSON.parse(text.slice(i+marker.length, end<0?undefined:end));
}

/* propriétés de création de la fenêtre ; n'écrit que ce qui diffère des valeurs par défaut de ScriptUI.
   Dialogue : pas de resizeable (comportement historique) ; retourne "" s'il n'y a rien à écrire. */
/* Propriétés de création documentées (Window object, JavaScript Tools Guide) :
   closeButton / minimizeButton : non utilisés pour les dialogues ;
   maximizeButton : vrai par défaut pour le type « window » → on l'écrit explicitement ;
   independent : type « window » uniquement ; su1PanelCoordinates : Photoshop uniquement. */
function windowProps(p){
  var parts=[], isDialog=p.winType==="dialog", isWin=p.winType==="window";
  if(!isDialog) parts.push("resizeable: "+(p.resizeable?"true":"false"));
  if(p.closeButton===false && !isDialog) parts.push("closeButton: false");
  if(p.minimizeButton && !isDialog) parts.push("minimizeButton: true");
  if(!isDialog && (p.maximizeButton || isWin)) parts.push("maximizeButton: "+(p.maximizeButton?"true":"false"));
  if(p.borderless) parts.push("borderless: true");
  if(p.independent && isWin) parts.push("independent: true");
  if(p.su1PanelCoordinates) parts.push("su1PanelCoordinates: true");
  return parts.length ? "{ "+parts.join(", ")+" }" : "";
}

/* image (data URL base64) → chaîne binaire encodée URI, relue dans ExtendScript par File.decode() */
function encodeImage(dataUrl){
  var b64=String(dataUrl).split(",")[1]||"";
  try{ return encodeURIComponent(atob(b64)); }catch(e){ return ""; }
}
function imageBytes(dataUrl){ var b64=String(dataUrl||"").split(",")[1]||""; return Math.floor(b64.length*3/4); }

/* directives en tête de fichier : #target, et #targetengine pour les palettes qui doivent
   rester ouvertes (Illustrator, InDesign, Bridge : sans moteur persistant elles se ferment aussitôt) */
function directives(p){
  var t=targetOf(p), out=[];
  if(t.target) out.push("#target "+t.target);
  // Illustrator : le moteur persistant qui fonctionne est « main » (un nom personnalisé n'y suffit pas toujours)
  if(t.engine && p.winType!=="dialog") out.push(p.targetApp==="illustrator" ? "#targetengine main" : '#targetengine "'+engineName(p)+'"');
  if(out.length) out.push("");
  return out;
}

function generateCode(root){
  var names=computeNames(root), L=[], p=root.props;
  var isDialog=p.winType==="dialog", isDock=p.winType==="dockable";
  var genH=!!p.genHandlers, loc=!!p.localize, handlers=[], settingsControls=[], pad="        ", needRedraw=false;

  function T(pr,key){
    var en=esc(pr[key]), fr=esc(pr.textFr);
    return (loc&&pr.textFr) ? 'localize({ en: "'+en+'", fr: "'+fr+'" })' : '"'+en+'"';
  }

  var tgt=targetOf(p);
  directives(p).forEach(function(d){ L.push(d); });
  L.push("/* =====================================================");
  L.push("   "+p.title+" — UI générée avec ScriptUI Dialog Designer v"+APP_VERSION);
  L.push("   Cible : "+tgt.label+" — ExtendScript (ES3)");
  if(isDock) L.push("   After Effects : fichier à placer dans le dossier ScriptUI Panels.");
  L.push("   ===================================================== */");
  L.push("");
  L.push("(function (thisObj) {");
  L.push("");
  if(p.persistSettings){
    L.push("    // Réglages mémorisés dans un fichier du dossier utilisateur (fonctionne dans toutes les applis)");
    L.push('    var SETTINGS_FILE = File(Folder.userData + "/'+esc(engineName(p))+'.settings");');
    L.push("");
  }
  L.push("    function buildUI(thisObj) {");
  var titleExpr = (loc&&p.titleFr) ? 'localize({ en: "'+esc(p.title)+'", fr: "'+esc(p.titleFr)+'" })' : '"'+esc(p.title)+'"';
  var wp=windowProps(p);
  if(isDock){
    L.push("        var win = (thisObj instanceof Panel)");
    L.push("            ? thisObj");
    L.push('            : new Window("palette", '+titleExpr+", undefined, "+wp+");");
  } else if(isDialog){
    L.push('        var win = new Window("dialog", '+titleExpr+(wp?", undefined, "+wp:"")+");");
  } else {
    L.push('        var win = new Window("'+p.winType+'", '+titleExpr+", undefined, "+wp+");");
  }
  L.push('        win.orientation = "'+p.orientation+'";');
  L.push('        win.alignChildren = "'+p.alignChildren+'";');
  L.push("        win.spacing = "+(p.spacing|0)+";");
  L.push("        win.margins = "+(p.margins|0)+";");
  L.push("");

  /* image : intégrée (chaîne binaire décodée par File.decode, une seule fois par image identique)
     ou, à défaut, fichier sur le disque */
  var imgVars={};
  function imgExpr(v,pr){
    if(!pr.imageData) return 'File("'+esc(pr.imagePath)+'")';
    var name=imgVars[pr.imageData];
    if(!name){
      name=v+"_imgString"; imgVars[pr.imageData]=name;
      L.push(pad+"// Image intégrée"+(pr.imageName?" ("+pr.imageName.replace(/\*\//g,"")+")":"")+" : aucun fichier externe nécessaire");
      L.push(pad+"var "+name+' = "'+encodeImage(pr.imageData)+'";');
    }
    return "File.decode("+name+")";
  }

  function emitCommon(v,pr,type){
    var al=alignValue(pr);
    if(al) L.push(pad+v+".alignment = "+al+";");
    if(pr.helpTip) L.push(pad+v+'.helpTip = "'+esc(pr.helpTip)+'";');
    if(pr.enabled===false) L.push(pad+v+".enabled = false;");
    if(pr.width>0) L.push(pad+v+".preferredSize.width = "+(pr.width|0)+";");
    if(pr.height>0) L.push(pad+v+".preferredSize.height = "+(pr.height|0)+";");
    if(pr.minWidth>0) L.push(pad+v+".minimumSize.width = "+(pr.minWidth|0)+";");
    if(pr.minHeight>0) L.push(pad+v+".minimumSize.height = "+(pr.minHeight|0)+";");
    if(pr.maxWidth>0) L.push(pad+v+".maximumSize.width = "+(pr.maxWidth|0)+";");
    if(pr.maxHeight>0) L.push(pad+v+".maximumSize.height = "+(pr.maxHeight|0)+";");
    if(FONT_TYPES[type] && (pr.fontStyle||pr.fontSize>0))
      L.push(pad+v+".graphics.font = ScriptUI.newFont("+v+'.graphics.font.name, "'+(pr.fontStyle||"REGULAR")+'", '+
        (pr.fontSize>0 ? (pr.fontSize|0) : v+".graphics.font.size")+");");
  }

  /* élément masqué : retiré de l'export, ou (option) exporté en commentaire.
     En commentaire, ses événements / réglages / images ne sont pas référencés ailleurs dans le code. */
  var hiddenDepth=0;
  function emit(node,parentVar,parentNode){
    if(!node.props.hidden || hiddenDepth>0) return emitInner(node,parentVar,parentNode);
    if(!p.hiddenAsComment) return;
    var m={l:L.length, h:handlers.length, s:settingsControls.length, img:assign(imgVars)};
    hiddenDepth++;
    emitInner(node,parentVar,parentNode);
    hiddenDepth--;
    handlers.length=m.h; settingsControls.length=m.s; imgVars=m.img;
    for(var k=m.l;k<L.length;k++) if(L[k].trim()) L[k]=L[k].replace(/^(\s*)/,"$1// ");
    L.splice(m.l,0,pad+"// ▼ « "+names[node.id]+" » masqué dans ScriptUI Dialog Designer — décommentez pour le réactiver");
  }
  function emitInner(node,parentVar,parentNode){
    var v=names[node.id], pr=node.props, i, items, opts, cp, rows, nCols;
    switch(node.type){
      case "group":
        L.push(pad+"var "+v+" = "+parentVar+'.add("group");');
        L.push(pad+v+'.orientation = "'+pr.orientation+'";');
        L.push(pad+v+'.alignChildren = "'+pr.alignChildren+'";');
        if((pr.spacing|0)!==10) L.push(pad+v+".spacing = "+(pr.spacing|0)+";");
        if((pr.margins|0)!==0) L.push(pad+v+".margins = "+(pr.margins|0)+";");
        emitCommon(v,pr,node.type); L.push("");
        node.children.forEach(function(c){ emit(c,v,node); });
        break;
      case "panel":
        L.push(pad+"var "+v+" = "+parentVar+'.add("panel", undefined, '+T(pr,"text")+
          (pr.borderStyle&&pr.borderStyle!=="etched" ? ', { borderStyle: "'+pr.borderStyle+'" }' : "")+");");
        L.push(pad+v+'.orientation = "'+pr.orientation+'";');
        L.push(pad+v+'.alignChildren = "'+pr.alignChildren+'";');
        L.push(pad+v+".spacing = "+(pr.spacing|0)+";");
        L.push(pad+v+".margins = "+(pr.margins|0)+";");
        emitCommon(v,pr,node.type); L.push("");
        node.children.forEach(function(c){ emit(c,v,node); });
        break;
      case "tabbedpanel":
        L.push(pad+"var "+v+" = "+parentVar+'.add("tabbedpanel");');
        L.push(pad+v+'.alignChildren = "fill";');
        emitCommon(v,pr,node.type); L.push("");
        node.children.forEach(function(c){ emit(c,v,node); });
        if(node.children.length) L.push(pad+v+".selection = "+Math.min(pr.selection|0,node.children.length-1)+"; // onglet actif");
        L.push("");
        break;
      case "verticaltabbedpanel": {
        // ScriptUI n'a pas d'onglets verticaux : ListBox de navigation + pages superposées (stack)
        var vtabs=node.children.filter(function(c){ return !c.props.hidden; });
        var vsel=Math.max(0,Math.min(pr.selection|0,vtabs.length-1));
        L.push(pad+"// Onglets verticaux (simulés) : liste à gauche, pages superposées à droite");
        L.push(pad+"var "+v+" = "+parentVar+'.add("group");');
        L.push(pad+v+'.orientation = "row";');
        L.push(pad+v+'.alignChildren = ["fill", "fill"];');
        emitCommon(v,pr,node.type);
        L.push(pad+"var "+v+"_nav = "+v+'.add("listbox", undefined, ['+vtabs.map(function(t){ return T(t.props,"text"); }).join(", ")+"]);");
        L.push(pad+v+"_nav.preferredSize.width = "+((pr.tabNavWidth|0)>0?(pr.tabNavWidth|0):110)+";");
        L.push(pad+v+'_nav.alignment = ["left", "fill"];');
        L.push(pad+"var "+v+"_pages = "+v+'.add("group");');
        L.push(pad+v+'_pages.orientation = "stack";');
        L.push(pad+v+'_pages.alignment = ["fill", "fill"];');
        L.push(pad+v+'_pages.alignChildren = ["fill", "top"];');
        L.push("");
        node.children.forEach(function(c){ emit(c,v+"_pages",node); });
        L.push(pad+"// Affiche la page choisie dans la liste");
        L.push(pad+v+"_nav.onChange = function () {");
        L.push(pad+"    if (!this.selection) return;");
        L.push(pad+"    for (var i = 0; i < "+v+"_pages.children.length; i++) "+v+"_pages.children[i].visible = (i === this.selection.index);");
        L.push(pad+"};");
        if(vtabs.length) L.push(pad+v+"_nav.selection = "+vsel+"; // onglet actif");
        L.push(pad+"for (var i_"+v+" = 0; i_"+v+" < "+v+"_pages.children.length; i_"+v+"++) "+v+"_pages.children[i_"+v+"].visible = (i_"+v+" === "+vsel+");");
        L.push("");
        break;
      }
      case "tab":
        if(parentNode && parentNode.type==="verticaltabbedpanel"){
          // page d'onglet vertical : simple groupe dans la pile
          L.push(pad+"var "+v+" = "+parentVar+'.add("group"); // page « '+String(pr.text).replace(/[\r\n]/g," ")+" »");
          L.push(pad+v+'.orientation = "'+pr.orientation+'";');
          L.push(pad+v+'.alignChildren = "'+pr.alignChildren+'";');
          L.push(pad+v+".spacing = "+(pr.spacing|0)+";");
          L.push(pad+v+".margins = "+(pr.margins|0)+";");
          L.push("");
          node.children.forEach(function(c){ emit(c,v,node); });
          break;
        }
        L.push(pad+"var "+v+" = "+parentVar+'.add("tab", undefined, '+T(pr,"text")+");");
        L.push(pad+v+'.orientation = "'+pr.orientation+'";');
        L.push(pad+v+'.alignChildren = "'+pr.alignChildren+'";');
        L.push(pad+v+".spacing = "+(pr.spacing|0)+";");
        L.push(pad+v+".margins = "+(pr.margins|0)+";");
        L.push("");
        node.children.forEach(function(c){ emit(c,v,node); });
        break;
      case "statictext":
        if(pr.multiline && pr.splitLines){
          // multiligne « fiable » : un StaticText par ligne, empilés dans un groupe sans espacement
          var enL=String(pr.text).split(/\r\n?|\n/), frL=String(pr.textFr||"").split(/\r\n?|\n/);
          L.push(pad+"// Texte multiligne découpé : une ligne = un StaticText");
          L.push(pad+"var "+v+" = "+parentVar+'.add("group");');
          L.push(pad+v+'.orientation = "column";');
          L.push(pad+v+'.alignChildren = ["'+(pr.justify||"left")+'", "center"];');
          L.push(pad+v+".spacing = 0;");
          emitCommon(v,pr,"group");
          enL.forEach(function(line,li){
            var lv=v+"_l"+(li+1);
            L.push(pad+"var "+lv+" = "+v+'.add("statictext", undefined, '+T({text:line,textFr:loc&&pr.textFr?(frL[li]||""):""},"text")+");");
            if(pr.fontStyle||pr.fontSize>0)
              L.push(pad+lv+".graphics.font = ScriptUI.newFont("+lv+'.graphics.font.name, "'+(pr.fontStyle||"REGULAR")+'", '+
                (pr.fontSize>0?(pr.fontSize|0):lv+".graphics.font.size")+");");
          });
          break;
        }
        cp=[];
        if(pr.multiline) cp.push("multiline: true");
        else if(pr.truncate&&pr.truncate!=="none") cp.push('truncate: "'+pr.truncate+'"');
        if(pr.justify&&pr.justify!=="left"){
          // doc Adobe : « Justification only works if the value is set on creation » → spécification ressource
          L.push(pad+"// justify n'agit qu'à la création (spécification ressource)");
          L.push(pad+"var "+v+" = "+parentVar+".add('statictext { justify: \""+pr.justify+"\""+
            (cp.length? ", properties: { "+cp.join(", ")+" }" : "")+" }');");
          L.push(pad+v+".text = "+T(pr,"text")+";");
        } else {
          L.push(pad+"var "+v+" = "+parentVar+'.add("statictext", undefined, '+T(pr,"text")+(cp.length?", { "+cp.join(", ")+" }":"")+");");
        }
        emitCommon(v,pr,node.type);
        break;
      case "edittext":
        cp=[];
        if(pr.multiline){ cp.push("multiline: true"); cp.push("scrolling: true"); }
        if(pr.readonly) cp.push("readonly: true");
        if(pr.noecho) cp.push("noecho: true");
        if(pr.enterKeySignalsOnChange) cp.push("enterKeySignalsOnChange: true");
        if(pr.wantReturn&&pr.multiline) cp.push("wantReturn: true");
        if(pr.justify && pr.justify!=="left"){
          // justify n'est pris en compte qu'à la création : spécification ressource inline
          L.push(pad+"// justify n'agit qu'à la création (spécification ressource)");
          L.push(pad+"var "+v+" = "+parentVar+".add('edittext { justify: \""+pr.justify+"\""+
            (cp.length? ", properties: { "+cp.join(", ")+" }" : "")+" }');");
          L.push(pad+v+'.text = "'+esc(pr.text)+'";');
        } else {
          opts = cp.length? ", { "+cp.join(", ")+" }" : "";
          L.push(pad+"var "+v+" = "+parentVar+'.add("edittext", undefined, "'+esc(pr.text)+'"'+opts+");");
        }
        if(pr.characters) L.push(pad+v+".characters = "+(pr.characters|0)+";");
        if(pr.multiline&&!(pr.height>0)) L.push(pad+v+".preferredSize.height = 60;");
        emitCommon(v,pr,node.type);
        if(pr.active) L.push(pad+v+".active = true; // focus à l'ouverture");
        if(genH) handlers.push([v,"onChange","// valeur : "+v+".text"]);
        if(pr.name) settingsControls.push({v:v,type:"edittext"});
        break;
      case "button":
        var nm=(pr.name||"").toLowerCase();
        var creation=(nm==="ok"||nm==="cancel")? ', { name: "'+nm+'" }' : "";
        L.push(pad+"var "+v+" = "+parentVar+'.add("button", undefined, '+T(pr,"text")+creation+");");
        emitCommon(v,pr,node.type);
        if(pr.active) L.push(pad+v+".active = true; // focus à l'ouverture");
        if(isDialog&&nm==="ok") handlers.push([v,"onClick","OK"]);
        else if(isDialog&&nm==="cancel") handlers.push([v,"onClick","win.close(0);"]);
        else handlers.push([v,"onClick",null]);
        break;
      case "iconbutton":
        cp=['style: "'+(pr.style||"button")+'"'];
        if(pr.toggle) cp.push("toggle: true");
        L.push(pad+"// Icône PNG/JPEG (jamais redimensionnée par ScriptUI)");
        L.push(pad+"var "+v+" = "+parentVar+'.add("iconbutton", undefined, '+imgExpr(v,pr)+', { '+cp.join(", ")+" });");
        emitCommon(v,pr,node.type);
        handlers.push([v,"onClick",null]);
        break;
      case "image":
        L.push(pad+"var "+v+" = "+parentVar+'.add("image", undefined, '+imgExpr(v,pr)+");");
        emitCommon(v,pr,node.type);
        break;
      case "checkbox":
        L.push(pad+"var "+v+" = "+parentVar+'.add("checkbox", undefined, '+T(pr,"text")+");");
        L.push(pad+v+".value = "+(pr.value?"true":"false")+";");
        emitCommon(v,pr,node.type);
        if(genH) handlers.push([v,"onClick","// état : "+v+".value"]);
        if(pr.name) settingsControls.push({v:v,type:"checkbox"});
        break;
      case "radiobutton":
        L.push(pad+"var "+v+" = "+parentVar+'.add("radiobutton", undefined, '+T(pr,"text")+");");
        if(pr.value) L.push(pad+v+".value = true;");
        emitCommon(v,pr,node.type);
        if(pr.name) settingsControls.push({v:v,type:"checkbox"});
        break;
      case "dropdownlist":
        items=String(pr.items).split(",").map(function(s){return '"'+esc(s.trim())+'"';}).join(", ");
        L.push(pad+"var "+v+" = "+parentVar+'.add("dropdownlist", undefined, ['+items+']); // "-" = séparateur');
        L.push(pad+v+".selection = "+(pr.selection|0)+";");
        emitCommon(v,pr,node.type);
        if(genH) handlers.push([v,"onChange","// choix : "+v+".selection ? "+v+".selection.text : null"]);
        if(pr.name) settingsControls.push({v:v,type:"list"});
        break;
      case "listbox":
        nCols=pr.numberOfColumns|0; rows=parseListRows(pr.items);
        if(nCols>1){
          cp=["numberOfColumns: "+nCols];
          if(pr.showHeaders){
            cp.push("showHeaders: true");
            cp.push("columnTitles: ["+String(pr.columnTitles).split(",").map(function(s){return '"'+esc(s.trim())+'"';}).join(", ")+"]");
          }
          if(colWidths(pr).length) cp.push("columnWidths: ["+colWidths(pr).join(", ")+"]");
          if(pr.multiselect) cp.push("multiselect: true");
          L.push(pad+"var "+v+" = "+parentVar+'.add("listbox", undefined, "", { '+cp.join(", ")+" });");
          rows.forEach(function(cells,ri){
            var iv=v+"It"+(ri+1);
            L.push(pad+"var "+iv+" = "+v+'.add("item", "'+esc(cells[0]||"")+'");');
            for(var ci=1;ci<nCols;ci++) L.push(pad+iv+".subItems["+(ci-1)+'].text = "'+esc(cells[ci]||"")+'";');
          });
        } else {
          items=rows.map(function(r){return '"'+esc(r[0])+'"';}).join(", ");
          opts=pr.multiselect? ", { multiselect: true }" : "";
          L.push(pad+"var "+v+" = "+parentVar+'.add("listbox", undefined, ['+items+"]"+opts+");");
        }
        if(!(pr.height>0)) L.push(pad+v+".preferredSize.height = 80;");
        emitCommon(v,pr,node.type);
        if(genH) handlers.push([v,"onChange","// sélection : "+v+".selection"]);
        if(pr.name) settingsControls.push({v:v,type:"list"});
        break;
      case "treeview":
        L.push(pad+"var "+v+" = "+parentVar+'.add("treeview");');
        if(!(pr.height>0)) L.push(pad+v+".preferredSize.height = 110;");
        emitCommon(v,pr,node.type);
        // TreeItem : « node » s'il contient des éléments (dépliable), sinon « item »
        (function addTreeItems(parentVar2,items){
          items.filter(function(it){ return !it.props.hidden; }).forEach(function(it){
            var kids=(it.children||[]).filter(function(c){ return !c.props.hidden; });
            var iv=names[it.id], ip=it.props;
            if(kids.length){
              L.push(pad+"var "+iv+" = "+parentVar2+'.add("node", '+T(ip,"text")+");");
              addTreeItems(iv,kids);
              if(ip.expanded!==false) L.push(pad+iv+".expanded = true;");
            } else if(ip.name){
              L.push(pad+"var "+iv+" = "+parentVar2+'.add("item", '+T(ip,"text")+");");
            } else {
              L.push(pad+parentVar2+'.add("item", '+T(ip,"text")+");");
            }
          });
        })(v,node.children);
        if(genH) handlers.push([v,"onChange","// sélection : "+v+".selection"]);
        break;
      case "slider":
        L.push(pad+"var "+v+" = "+parentVar+'.add("slider", undefined, '+Number(pr.value)+", "+Number(pr.min)+", "+Number(pr.max)+");");
        emitCommon(v,pr,node.type);
        if(genH) handlers.push([v,"onChanging","// valeur : "+v+".value"]);
        if(pr.name) settingsControls.push({v:v,type:"num"});
        break;
      case "scrollbar":
        L.push(pad+"// Orientation auto : horizontal si width > height, sinon vertical");
        L.push(pad+"var "+v+" = "+parentVar+'.add("scrollbar", undefined, '+Number(pr.value)+", "+Number(pr.min)+", "+Number(pr.max)+");");
        if(pr.stepdelta&&Number(pr.stepdelta)!==1) L.push(pad+v+".stepdelta = "+Number(pr.stepdelta)+";");
        emitCommon(v,pr,node.type);
        if(genH) handlers.push([v,"onChanging","// valeur : "+v+".value"]);
        if(pr.name) settingsControls.push({v:v,type:"num"});
        break;
      case "progressbar":
        L.push(pad+"var "+v+" = "+parentVar+'.add("progressbar", undefined, '+Number(pr.value)+", "+Number(pr.max)+");");
        emitCommon(v,pr,node.type);
        break;
      case "custom": // élément dessiné à la main
        L.push(pad+"// Élément dessiné (onDraw) — couleurs [r, g, b, a] entre 0 et 1");
        // type documenté : customButton (cliquable) ou customView (affichage seul)
        L.push(pad+"var "+v+" = "+parentVar+".add(\"custom { type: '"+(pr.clickable?"customButton":"customView")+"' }\");");
        L.push(pad+v+".text = "+T(pr,"text")+";");
        emitCommon(v,pr,node.type);
        L.push(pad+v+".fillColor = "+rgbArray(pr.fillColor)+";");
        if(pr.clickable) L.push(pad+v+".hoverColor = "+rgbArray(pr.hoverColor)+";");
        L.push(pad+v+".textColor = "+rgbArray(pr.textColor)+";");
        L.push(pad+v+".onDraw = function () {");
        L.push(pad+"    var gfx = this.graphics, w = this.size[0], h = this.size[1];");
        L.push(pad+"    var col = (this.hover && this.enabled) ? this.hoverColor : this.fillColor;");
        L.push(pad+"    gfx.newPath();");
        L.push(pad+"    gfx.rectPath(0, 0, w, h);");
        L.push(pad+"    gfx.fillPath(gfx.newBrush(gfx.BrushType.SOLID_COLOR, col));");
        L.push(pad+"    if (this.text) {");
        L.push(pad+"        var pen = gfx.newPen(gfx.PenType.SOLID_COLOR, this.textColor, 1);");
        L.push(pad+"        var ts = gfx.measureString(this.text);");
        L.push(pad+"        gfx.drawString(this.text, pen, (w - ts[0]) / 2, (h - ts[1]) / 2);");
        L.push(pad+"    }");
        L.push(pad+"};");
        if(pr.clickable){
          needRedraw=true;
          L.push(pad+v+'.addEventListener("mouseover", function () { this.hover = true; redrawCustom(this); });');
          L.push(pad+v+'.addEventListener("mouseout", function () { this.hover = false; redrawCustom(this); });');
          handlers.push([v,"click",null]);
        }
        break;
      case "divider": // séparateur horizontal : panel de 2 px de haut
        L.push(pad+"var "+v+" = "+parentVar+'.add("panel"); // séparateur horizontal');
        L.push(pad+v+'.alignment = "'+(pr.alignment||"fill")+'";');
        L.push(pad+v+".preferredSize.height = 2;");
        if(pr.width>0) L.push(pad+v+".preferredSize.width = "+(pr.width|0)+";");
        break;
      case "dividerv": // séparateur vertical : panel de 2 px de large, étiré sur la hauteur
        L.push(pad+"var "+v+" = "+parentVar+'.add("panel"); // séparateur vertical');
        L.push(pad+v+'.alignment = "'+(pr.alignment||"fill")+'";');
        L.push(pad+v+".preferredSize.width = 2;");
        if(pr.height>0) L.push(pad+v+".preferredSize.height = "+(pr.height|0)+";");
        break;
    }
    L.push("");
  }

  root.children.forEach(function(c){ emit(c,"win",root); });

  var genSet = p.genSettings && settingsControls.length;
  if(genSet){
    L.push("        // --- Lecture groupée des valeurs nommées ---");
    L.push("        win.getSettings = function () {");
    L.push("            return {");
    settingsControls.forEach(function(s,i){
      var comma = i<settingsControls.length-1 ? "," : "";
      if(s.type==="edittext") L.push("                "+s.v+": "+s.v+".text"+comma);
      else if(s.type==="checkbox") L.push("                "+s.v+": "+s.v+".value"+comma);
      else if(s.type==="list") L.push("                "+s.v+": "+s.v+".selection ? "+s.v+".selection.index : -1"+comma);
      else L.push("                "+s.v+": "+s.v+".value"+comma);
    });
    L.push("            };");
    L.push("        };");
    L.push("");
  }

  if(p.persistSettings && settingsControls.length){
    L.push("        // --- Persistance entre sessions (fichier de réglages : toutes les applis) ---");
    L.push("        function saveSettings() {");
    L.push("            var s = {");
    settingsControls.forEach(function(s,i){
      var comma = i<settingsControls.length-1 ? "," : "";
      if(s.type==="edittext") L.push("                "+s.v+": "+s.v+".text"+comma);
      else if(s.type==="checkbox") L.push("                "+s.v+": "+s.v+".value"+comma);
      else if(s.type==="list") L.push("                "+s.v+": "+s.v+".selection ? "+s.v+".selection.index : -1"+comma);
      else L.push("                "+s.v+": "+s.v+".value"+comma);
    });
    L.push("            };");
    L.push("            try {");
    L.push('                SETTINGS_FILE.encoding = "UTF-8";');
    L.push('                SETTINGS_FILE.open("w");');
    L.push("                SETTINGS_FILE.write(s.toSource());");
    L.push("                SETTINGS_FILE.close();");
    L.push("            } catch (e) {}");
    L.push("        }");
    L.push("        function loadSettings() {");
    L.push("            if (!SETTINGS_FILE.exists) return;");
    L.push("            var s = null;");
    L.push("            try {");
    L.push('                SETTINGS_FILE.encoding = "UTF-8";');
    L.push('                SETTINGS_FILE.open("r");');
    L.push("                s = eval(SETTINGS_FILE.read());");
    L.push("                SETTINGS_FILE.close();");
    L.push("            } catch (e) { return; }");
    L.push("            if (!s) return;");
    settingsControls.forEach(function(s){
      var has="s."+s.v+" !== undefined";
      if(s.type==="edittext") L.push("            if ("+has+") "+s.v+".text = s."+s.v+";");
      else if(s.type==="checkbox") L.push("            if ("+has+") "+s.v+".value = !!s."+s.v+";");
      else if(s.type==="list") L.push("            if ("+has+" && s."+s.v+" >= 0) "+s.v+".selection = s."+s.v+";");
      else L.push("            if ("+has+") "+s.v+".value = s."+s.v+";");
    });
    L.push("        }");
    L.push("        loadSettings();");
    if(!isDialog) L.push("        win.onClose = function () { saveSettings(); };");
    L.push("");
  }

  // regroupement d'annulation : chaque appli a le sien (ou n'en a pas)
  var undoKind = targetOf(p).undo, needUndo=false;
  if(handlers.length){
    L.push("        // --- Événements ---");
    handlers.forEach(function(h){
      var v=h[0],evt=h[1],body=h[2], listener=evt==="click";   // Custom : pas d'onClick, on écoute l'événement
      L.push(listener ? "        "+v+'.addEventListener("click", function () {' : "        "+v+"."+evt+" = function () {");
      if(body==="OK"){
        if(p.persistSettings&&settingsControls.length) L.push("            saveSettings();");
        L.push("            win.close(1);");
      } else if(body && body.indexOf("//")===0){
        L.push("            "+body);
        L.push("            // TODO : votre action ici");
      } else if(body){
        L.push("            "+body);
      } else if(undoKind){
        needUndo=true;
        L.push('            runAsOneUndo("'+esc(p.title)+'", function () {');
        L.push("                // TODO : votre action ici (annulable en une seule fois)");
        L.push("            });");
      } else {
        L.push("            // TODO : votre action ici");
      }
      L.push(listener ? "        });" : "        };");
      L.push("");
    });
  }

  if(needUndo){
    L.push("        // Exécute fn comme une seule étape d'annulation ("+targetOf(p).label+")");
    L.push("        function runAsOneUndo(name, fn) {");
    if(undoKind==="ae"){
      L.push("            app.beginUndoGroup(name);");
      L.push("            try { fn(); } finally { app.endUndoGroup(); }");
    } else if(undoKind==="ps"){
      L.push("            if (!app.documents.length) { fn(); return; }");
      L.push("            // suspendHistory évalue une chaîne dans la portée globale : on y expose fn");
      L.push("            $.global.__sudUndoFn = fn;");
      L.push('            app.activeDocument.suspendHistory(name, "__sudUndoFn()");');
    } else if(undoKind==="id"){
      L.push("            app.doScript(fn, ScriptLanguage.JAVASCRIPT, undefined, UndoModes.ENTIRE_SCRIPT, name);");
    }
    L.push("        }");
    L.push("");
  }

  if(needRedraw){
    L.push("        // Redessine un élément Custom au survol (sans effet si l'appli ne le permet pas)");
    L.push("        function redrawCustom(el) {");
    L.push('            try { el.notify("onDraw"); } catch (e) {}');
    L.push("        }");
    L.push("");
  }

  L.push("        win.layout.layout(true);");
  if(!isDialog){
    L.push("        win.layout.resize();");
    L.push("        win.onResizing = win.onResize = function () { this.layout.resize(); };");
  }
  L.push("        return win;");
  L.push("    }");
  L.push("");
  var show = p.exportShow!==false;
  if(isDialog){
    L.push("    var dlg = buildUI(thisObj);");
    if(show){
      L.push('    // ENTRÉE déclenche le bouton "ok", ÉCHAP le bouton "cancel" (natif)');
      L.push("    if (dlg.show() === 1) {");
      if(genSet){ L.push("        var settings = dlg.getSettings();"); L.push("        // Exemple : alert(settings.toSource());"); }
      else L.push("        // OK validé — récupérer les valeurs ici");
      L.push("    }");
    } else L.push("    // Pour afficher : if (dlg.show() === 1) { … }");
  } else {
    L.push("    var myPal = buildUI(thisObj);");
    if(show){
      L.push("    if (myPal instanceof Window) {");
      L.push("        myPal.center();");
      L.push("        myPal.show();");
      L.push("    }");
    } else L.push("    // Pour afficher : myPal.center(); myPal.show();");
  }
  L.push("");
  L.push("})(this);");

  // --- réglages d'export ---
  if(p.exportWrapper===false) unwrapFunction(L);
  if(p.refList){
    var refs=referenceList(root,names);
    if(refs.length){ L.push(""); L.push("/* Références des contrôles nommés (à utiliser dans votre code) :"); refs.forEach(function(r){ L.push("   "+r); }); L.push("*/"); }
  }
  reindent(L,p.indentSize);
  if(p.embedModel!==false){ L.push(""); L.push(modelLine(root)); }
  return L.join("\n");
}

/* retire l'enveloppe (function (thisObj) { … })(this); : le code passe au niveau global, décalé d'un cran */
function unwrapFunction(L){
  var start=L.indexOf("(function (thisObj) {"), end=L.lastIndexOf("})(this);");
  if(start<0||end<0) return;
  for(var i=start+1;i<end;i++) L[i]=L[i].replace(/^ {4}/,"").replace(/buildUI\(thisObj\);$/,"buildUI(this);");
  L.splice(end,1);
  L.splice(start,1);
  if(L[start]==="") L.splice(start,1);   // ligne vide qui suivait l'ouverture
}
/* indentation : le générateur écrit par pas de 4 espaces ; conversion éventuelle en 2 */
function reindent(L,size){
  if(String(size)!=="2") return;
  for(var i=0;i<L.length;i++){
    L[i]=L[i].replace(/^( {4})+/,function(m){ return new Array(m.length/2+1).join(" "); });
  }
}
/* « var  (Type)  → accès à la valeur » pour chaque contrôle nommé */
var REF_ACCESS={edittext:".text",statictext:".text",checkbox:".value",radiobutton:".value",dropdownlist:".selection",
  listbox:".selection",treeview:".selection",slider:".value",scrollbar:".value",progressbar:".value",tabbedpanel:".selection",verticaltabbedpanel:"_nav.selection",
  button:".onClick",iconbutton:".onClick",custom:".onDraw"};
function referenceList(root,names){
  var out=[], w=0;
  walkVisible(root,function(n){ if(n.type!=="root"&&n.props.name) w=Math.max(w,names[n.id].length); });
  walkVisible(root,function(n){
    if(n.type==="root"||!n.props.name) return;
    var v=names[n.id];
    out.push(v+new Array(w-v.length+3).join(" ")+"("+CONTROL_DEFS[n.type].label.replace(/ .*/,"")+")"+
      (REF_ACCESS[n.type]?"  → "+v+REF_ACCESS[n.type]:""));
  });
  return out;
}

/* ---------- resource string ---------- */
var RES_TYPE={group:"Group",panel:"Panel",tabbedpanel:"TabbedPanel",verticaltabbedpanel:"Group",tab:"Tab",statictext:"StaticText",
  edittext:"EditText",button:"Button",iconbutton:"IconButton",image:"Image",checkbox:"Checkbox",
  radiobutton:"RadioButton",dropdownlist:"DropDownList",listbox:"ListBox",treeview:"TreeView",
  slider:"Slider",scrollbar:"Scrollbar",progressbar:"Progressbar",divider:"Panel",dividerv:"Panel",custom:"Custom"};

/* type ScriptUI d'un élément dans la resource : les onglets verticaux (simulés) deviennent des groupes */
function resType(node,parentType){
  if(node.type==="tab" && parentType==="verticaltabbedpanel") return "Group";
  return RES_TYPE[node.type];
}
function generateResource(root){
  var names=computeNames(root), p=root.props, out=directives(p), lines=[], isDock=p.winType==="dockable";
  out.push("/* Resource string ScriptUI (syntaxe déclarative) — généré par ScriptUI Dialog Designer v"+APP_VERSION+".");
  out.push("   Cible : "+targetOf(p).label+".");
  out.push("   Non gérés ici : items de TreeView, police, localisation, onglet actif, dessin (onDraw) des Custom,");
  out.push("   images intégrées (la resource utilise le chemin du fichier — l'export .jsx, lui, intègre l'image),");
  out.push("   navigation des onglets verticaux (pages exportées comme groupes superposés, liste à ajouter par code),");
  out.push("   événements et persistance — à câbler par code (voir l'onglet Code .jsx). */");
  out.push("");
  function q(s){ return "'"+escQ(s)+"'"; }
  function listOf(str){ return "["+String(str).split(",").map(function(s){ return q(s.trim().split("|")[0].trim()); }).join(", ")+"]"; }
  function propsOf(node,parentType){
    var pr=node.props,t=node.type,parts=[],cp=[],pw=-1,ph=-1;
    var vPage = t==="tab" && parentType==="verticaltabbedpanel";   // page d'onglet vertical = groupe (pas de texte)
    if(pr.text!==undefined && t!=="edittext" && !vPage) parts.push("text: "+q(pr.text));
    if(t==="verticaltabbedpanel") parts.push("orientation: 'stack'");
    if(t==="edittext"){
      parts.push("text: "+q(pr.text));
      if(pr.characters) parts.push("characters: "+(pr.characters|0));
      if(pr.justify&&pr.justify!=="left") parts.push("justify: '"+pr.justify+"'");
      if(pr.multiline){ cp.push("multiline: true"); cp.push("scrolling: true"); }
      if(pr.readonly) cp.push("readonly: true");
      if(pr.noecho) cp.push("noecho: true");
    }
    if(t==="statictext"){
      if(pr.justify&&pr.justify!=="left") parts.push("justify: '"+pr.justify+"'");
      if(pr.multiline) cp.push("multiline: true");
      else if(pr.truncate&&pr.truncate!=="none") cp.push("truncate: '"+pr.truncate+"'");
    }
    if(t==="edittext"){
      if(pr.enterKeySignalsOnChange) cp.push("enterKeySignalsOnChange: true");
      if(pr.wantReturn&&pr.multiline) cp.push("wantReturn: true");
    }
    if(t==="panel"&&pr.borderStyle&&pr.borderStyle!=="etched") cp.push("borderStyle: '"+pr.borderStyle+"'");
    if(t==="group"||t==="panel"||t==="tab"){
      parts.push("orientation: '"+pr.orientation+"'");
      parts.push("alignChildren: '"+pr.alignChildren+"'");
      parts.push("spacing: "+(pr.spacing|0));
      parts.push("margins: "+(pr.margins|0));
    }
    if(t==="button"){
      var nm=(pr.name||"").toLowerCase();
      if(nm==="ok"||nm==="cancel") cp.push("name: '"+nm+"'");
    }
    if(t==="checkbox"||t==="radiobutton") parts.push("value: "+(pr.value?"true":"false"));
    if(t==="dropdownlist") cp.push("items: "+listOf(pr.items));
    if(t==="listbox"){
      cp.push("items: "+listOf(pr.items));
      if(pr.multiselect) cp.push("multiselect: true");
      if((pr.numberOfColumns|0)>1){
        cp.push("numberOfColumns: "+(pr.numberOfColumns|0));
        if(pr.showHeaders){ cp.push("showHeaders: true"); cp.push("columnTitles: "+listOf(pr.columnTitles)); }
        if(colWidths(pr).length) cp.push("columnWidths: ["+colWidths(pr).join(", ")+"]");
      }
    }
    if(t==="slider"||t==="scrollbar"){ parts.push("value: "+Number(pr.value)); parts.push("minvalue: "+Number(pr.min)); parts.push("maxvalue: "+Number(pr.max)); }
    if(t==="scrollbar"&&pr.stepdelta&&Number(pr.stepdelta)!==1) parts.push("stepdelta: "+Number(pr.stepdelta));
    if(t==="progressbar"){ parts.push("value: "+Number(pr.value)); parts.push("maxvalue: "+Number(pr.max)); }
    if(t==="iconbutton"||t==="image") parts.push("image: "+q(pr.imagePath));
    if(t==="iconbutton"){ cp.push("style: '"+(pr.style||"button")+"'"); if(pr.toggle) cp.push("toggle: true"); }
    if(t==="custom") parts.push("type: '"+(pr.clickable?"customButton":"customView")+"'");
    var al=alignValue(pr,"'");
    if(t==="divider"||t==="dividerv") al="'"+(pr.alignment||"fill")+"'";
    if(al) parts.push("alignment: "+al);
    if(pr.helpTip) parts.push("helpTip: "+q(pr.helpTip));
    if(pr.enabled===false) parts.push("enabled: false");
    if(pr.active) parts.push("active: true");
    // une seule preferredSize (les séparateurs imposent 2 px sur un axe)
    if(pr.width>0) pw=pr.width|0;
    if(pr.height>0) ph=pr.height|0;
    if(t==="divider") ph=2;
    if(t==="dividerv") pw=2;
    if(pw>0||ph>0) parts.push("preferredSize: ["+pw+", "+ph+"]");
    if(pr.minWidth>0||pr.minHeight>0) parts.push("minimumSize: ["+(pr.minWidth|0)+", "+(pr.minHeight|0)+"]");
    if(pr.maxWidth>0||pr.maxHeight>0) parts.push("maximumSize: ["+(pr.maxWidth>0?pr.maxWidth|0:10000)+", "+(pr.maxHeight>0?pr.maxHeight|0:10000)+"]");
    if(cp.length) parts.push("properties: { "+cp.join(", ")+" }");
    return parts.join(", ");
  }
  function emit(node,indent,parentType){
    var ind=new Array(indent+1).join("  "), ps=propsOf(node,parentType);
    var kids=(node.children||[]).filter(function(c){ return !c.props.hidden && c.type!=="treeitem"; });   // items de TreeView : à ajouter par code
    if(kids.length){
      lines.push(ind+names[node.id]+": "+resType(node,parentType)+" { "+ps+(ps?",":""));
      kids.forEach(function(c,i){ emit(c,indent+1,node.type); if(i<kids.length-1) lines[lines.length-1]+=","; });
      lines.push(ind+"}");
    } else lines.push(ind+names[node.id]+": "+resType(node,parentType)+" { "+ps+" }");
  }
  var rootType = isDock ? "group" : p.winType;
  var wp = isDock ? "" : windowProps(p).replace(/"/g,"'");
  var head = rootType+" { "+(isDock?"":"text: "+q(p.title)+", ")+
    "orientation: '"+p.orientation+"', alignChildren: '"+p.alignChildren+"', spacing: "+(p.spacing|0)+", margins: "+(p.margins|0)+
    (wp ? ", properties: "+wp : "");
  var rkids=root.children.filter(function(c){ return !c.props.hidden; });
  lines.push(head+(rkids.length?",":""));
  rkids.forEach(function(c,i){ emit(c,1,"root"); if(i<rkids.length-1) lines[lines.length-1]+=","; });
  lines.push("}");
  out.push('var res = "" +');
  lines.forEach(function(l,i){
    out.push('    "'+l.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+(i<lines.length-1?' " +':'";'));
  });
  out.push("");
  if(isDock){
    out.push("// Panneau dockable : la resource décrit le contenu, ajouté au Panel (ou à une palette de secours)");
    out.push('var win = (this instanceof Panel) ? this : new Window("palette", "'+esc(p.title)+'", undefined, '+windowProps(p)+");");
    out.push("win.margins = 0;");
    out.push("var ui = win.add(res);");
    out.push('ui.alignment = ["fill", "fill"];');
    out.push("win.layout.layout(true);");
    out.push("win.onResizing = win.onResize = function () { this.layout.resize(); };");
    out.push("if (win instanceof Window) { win.center(); win.show(); }");
  } else {
    out.push("var win = new Window(res);");
    if(p.exportShow!==false){ out.push("win.center();"); out.push("win.show();"); }
    else out.push("// Pour afficher : win.center(); win.show();");
  }
  reindent(out,p.indentSize);
  if(p.embedModel!==false){ out.push(""); out.push(modelLine(root)); }
  return out.join("\n");
}

/* ============================================================
   ÉTAT + RENDU DOM
   ============================================================ */
var S = {
  tree: tplOkCancel(),
  selId: "root",
  tab: "preview",
  mode: "edit",
  tplOpen: false,
  helpOpen: false,
  notice: "",
  past: [], future: [],
  snapshots: [], snapOpen: false,
  pan: {x:0,y:0}, zoom: 1, spaceDown: false,
  collapsed: {}, ctx: null,
  clip: null,                      // contrôle copié (Ctrl+C)
  testTree: null, testBase: null   // mode Test : copie jetable de la maquette
};

/* --- historique ---
   Une saisie continue dans un même champ de l'inspecteur = une seule étape d'annulation. */
var EDIT={key:null};
function pushHistory(){
  S.past.push(clone(S.tree));
  if(S.past.length>120) S.past.shift();
  S.future=[];
  EDIT.key=null;
}
function beginEdit(field){
  var key=S.selId+":"+field;
  if(EDIT.key!==key){ pushHistory(); EDIT.key=key; }
}
function undo(){ if(!S.past.length) return; EDIT.key=null; S.future.push(clone(S.tree)); S.tree=S.past.pop(); S.selId=findNode(S.tree,S.selId)?S.selId:"root"; render(); }
function redo(){ if(!S.future.length) return; EDIT.key=null; S.past.push(clone(S.tree)); S.tree=S.future.pop(); S.selId=findNode(S.tree,S.selId)?S.selId:"root"; render(); }

/* re-rendu qui préserve la saisie en cours dans l'inspecteur */
function renderKeepFocus(){
  var ae=document.activeElement;
  render(!!(ae&&ae.closest&&ae.closest(".right")));
}
function note(msg){
  S.notice=msg;
  setTimeout(function hide(){
    if(S.notice!==msg) return;
    // pas de re-rendu pendant un glisser-déposer : il remplacerait les zones survolées (et leur état)
    if(dndBusy()){ setTimeout(hide,300); return; }
    S.notice=""; renderKeepFocus();
  },2600);
}
function flash(msg){ note(msg); renderKeepFocus(); }

/* --- mode Test : on joue sur une copie, la maquette n'est jamais modifiée ---
   La copie est recréée dès que la maquette change (inspecteur, annulation…). */
function viewTree(){
  if(S.mode!=="test") return S.tree;
  var cur=JSON.stringify(S.tree);
  if(S.testBase!==cur){ S.testTree=JSON.parse(cur); S.testBase=cur; }
  return S.testTree;
}
function resetTest(){ S.testBase=null; render(); }

/* --- sauvegarde automatique (navigateur) --- */
var _saveT=null;
var _saveWarned=false;
function saveNow(){
  clearTimeout(_saveT); _saveT=null;
  try{ localStorage.setItem(SAVE_KEY,JSON.stringify({version:APP_VERSION,tree:S.tree,snapshots:S.snapshots})); _saveWarned=false; }
  catch(e){
    // prévenir une fois, en distinguant « stockage plein » de « stockage bloqué » (navigation privée, fichier ouvert en data:, réglages…)
    if(!_saveWarned){
      _saveWarned=true;
      var full = e && (e.name==="QuotaExceededError" || e.name==="NS_ERROR_DOM_QUOTA_REACHED" || e.code===22);
      flash(full
        ? "⚠ Sauvegarde automatique impossible : maquette trop lourde pour le navigateur (images ?). Utilisez JSON ⇩ pour l'enregistrer."
        : "⚠ Sauvegarde automatique indisponible : ce navigateur bloque le stockage local pour cette page. Utilisez JSON ⇩ pour enregistrer votre travail.");
    }
  }
}
function saveLater(){ clearTimeout(_saveT); _saveT=setTimeout(saveNow,400); }
function restoreSaved(){
  var raw=null;
  try{
    raw=localStorage.getItem(SAVE_KEY);
    if(!raw) raw=localStorage.getItem(LEGACY_SAVE_KEY);   // travail sauvegardé avant le changement de nom
  }catch(e){ return false; }
  if(!raw) return false;
  try{
    var d=JSON.parse(raw);
    sanitizeTree(d.tree);
    S.tree=d.tree;
    S.snapshots=(d.snapshots||[]).filter(function(sn){
      try{ sanitizeTree(sn.tree); return true; }catch(e){ return false; }
    });
    return true;
  }catch(e){ return false; }
}
window.addEventListener("beforeunload",function(){ if(_saveT) saveNow(); });

/* helper création DOM */
function h(tag,attrs){
  var e=document.createElement(tag),k,i;
  attrs=attrs||{};
  for(k in attrs){ if(!attrs.hasOwnProperty(k)) continue;
    var v=attrs[k];
    if(k==="class") e.className=v;
    else if(k==="text") e.textContent=v;
    else if(k==="html") e.innerHTML=v;
    else if(k==="style"){ for(var s in v) if(v[s]!==undefined&&v[s]!==null) e.style[s]=v[s]; }
    else if(k.slice(0,2)==="on") e[k]=v;
    else if(v===true) e.setAttribute(k,"");
    else if(v!==false&&v!==null&&v!==undefined) e.setAttribute(k,v);
  }
  for(i=2;i<arguments.length;i++){
    var c=arguments[i];
    if(c===null||c===undefined||c===false) continue;
    if(Array.isArray(c)) c.forEach(function(x){ if(x) e.appendChild(typeof x==="string"?document.createTextNode(x):x); });
    else e.appendChild(typeof c==="string"?document.createTextNode(c):c);
  }
  return e;
}

/* ---------- layout mapping ---------- */
function flexAlign(a){ return {left:"flex-start",right:"flex-end",top:"flex-start",bottom:"flex-end",center:"center",fill:"stretch"}[a]||"flex-start"; }
var GRID_ALIGN={left:"start",top:"start",right:"end",bottom:"end",center:"center",fill:"stretch"};
function applySelfAlign(st,pr,parentOrientation){
  var a=pr.alignment, v=pr.alignV;
  if(parentOrientation==="stack"){          // enfants superposés dans la même cellule
    st.gridArea="1 / 1";
    if(a) st.justifySelf=GRID_ALIGN[a]||"auto";
    if(v) st.alignSelf=GRID_ALIGN[v]||"auto";
    return st;
  }
  if(v){                                    // tableau [horizontal, vertical]
    var hz=ALIGN_H.indexOf(a)>=0?a:"left";
    if(parentOrientation==="row"){ st.alignSelf=flexAlign(v); if(hz==="fill") st.flex="1 1 auto"; }
    else { st.alignSelf=flexAlign(hz); if(v==="fill") st.flex="1 1 auto"; }
    return st;
  }
  if(!a) return st;
  if(a==="fill"){ st.alignSelf="stretch"; if(parentOrientation==="row") st.flex="1 1 auto"; return st; }
  st.alignSelf={left:"flex-start",top:"flex-start",center:"center",right:"flex-end",bottom:"flex-end"}[a]||"auto";
  return st;
}
function containerStyle(n){
  var pr=n.props;
  if(pr.orientation==="stack")
    return {display:"grid",padding:(pr.margins|0)+"px",justifyItems:GRID_ALIGN[pr.alignChildren]||"start",alignItems:"start"};
  return {display:"flex",flexDirection:pr.orientation==="row"?"row":"column",
    gap:(pr.spacing|0)+"px",padding:(pr.margins|0)+"px",alignItems:flexAlign(pr.alignChildren)};
}
/* police (graphics.font) + tailles min/max, appliquées à l'aperçu */
function fontCss(pr,st){
  if(pr.fontStyle==="BOLD"||pr.fontStyle==="BOLDITALIC") st.fontWeight="700";
  if(pr.fontStyle==="ITALIC"||pr.fontStyle==="BOLDITALIC") st.fontStyle="italic";
  if(pr.fontSize>0) st.fontSize=(pr.fontSize|0)+"px";
  return st;
}
function sizeCss(pr,st){
  if(pr.minWidth>0) st.minWidth=(pr.minWidth|0)+"px";
  if(pr.minHeight>0) st.minHeight=(pr.minHeight|0)+"px";
  if(pr.maxWidth>0) st.maxWidth=(pr.maxWidth|0)+"px";
  if(pr.maxHeight>0) st.maxHeight=(pr.maxHeight|0)+"px";
  return st;
}

/* ---------- opérations ---------- */
function setProp(key,val){
  var n=findNode(S.tree,S.selId); if(!n||n.props[key]===val) return;
  pushHistory(); n.props[key]=val;
  render();
}
function addControl(type){
  // plusieurs éléments sélectionnés + conteneur cliqué dans la palette = les ranger dedans
  if(S.multi && (type==="group"||type==="panel"||TAB_HOSTS[type])){ wrapSelection(type); return; }
  S.multi=null;
  var target=findNode(S.tree,S.selId);
  pushHistory();
  if(type==="tab"){
    var tp = (target&&TAB_HOSTS[target.type]) ? target : findTabHost(S.selId);
    if(!tp){ S.past.pop(); flash("Un Tab doit être ajouté dans un TabbedPanel : sélectionnez-en un d'abord."); return; }
    var t=makeNode("tab"); tp.children.push(t); S.selId=t.id; render(); return;
  }
  if(type==="treeitem"){
    // dans le TreeItem / TreeView sélectionné, ou dans le TreeView qui contient la sélection
    var th=findTreeHost(S.selId);
    if(!th){ S.past.pop(); flash("Un TreeItem doit être ajouté dans un TreeView : sélectionnez-en un d'abord."); return; }
    var ti=makeNode("treeitem"); th.children.push(ti); S.collapsed[th.id]=false; S.selId=ti.id; render(); return;
  }
  // un autre contrôle ne va jamais dans un TreeView : on remonte au conteneur qui l'accueille
  while(target && TREE_HOSTS[target.type]) target=findParent(S.tree,target.id);
  if(!target || (CONTAINER_TYPES.indexOf(target.type)<0 && !TAB_HOSTS[target.type])) target=findParent(S.tree,target?target.id:S.selId)||S.tree;
  if(TAB_HOSTS[target.type]){
    var idx=Math.min(target.props.selection|0,Math.max(target.children.length-1,0));
    target=target.children[idx]||target;
    if(TAB_HOSTS[target.type]){ S.past.pop(); flash("Ajoutez d'abord un Tab dans ce TabbedPanel."); return; }
  }
  if(CONTAINER_TYPES.indexOf(target.type)<0) target=S.tree;
  var n=makeNode(type); target.children.push(n); S.selId=n.id; render();
}
function moveSel(dir){
  var p=findParent(S.tree,S.selId); if(!p) return;
  var i=-1,j;
  p.children.forEach(function(c,k){ if(c.id===S.selId) i=k; });
  j=i+dir; if(j<0||j>=p.children.length) return;
  pushHistory();
  var n=p.children.splice(i,1)[0]; p.children.splice(j,0,n); render();
}
function removeNodeById(id){
  if(!id||id==="root") return false;
  var p=findParent(S.tree,id); if(!p) return false;
  var n=findNode(S.tree,id);
  var label=(CONTROL_DEFS[n.type]?CONTROL_DEFS[n.type].label:n.type);
  pushHistory();
  p.children=p.children.filter(function(c){ return c.id!==id; });
  if(!findNode(S.tree,S.selId)) S.selId=p.id;
  note(label+" supprimé — Ctrl+Z pour annuler");
  render();
  return true;
}
function duplicateNodeById(id){
  if(!id||id==="root") return false;
  var p=findParent(S.tree,id); if(!p) return false;
  var i=-1; p.children.forEach(function(c,k){ if(c.id===id) i=k; });
  if(i<0) return false;
  pushHistory();
  var copy=reId(clone(p.children[i]));
  p.children.splice(i+1,0,copy); S.selId=copy.id;
  note("Copie créée — donnez-lui un nom de variable unique");
  render();
  return true;
}
function removeSel(){ if(S.multi) removeSelection(); else removeNodeById(S.selId); }

/* ---------- sélection multiple (Maj+clic = plage, Ctrl+clic = ajouter/retirer) ----------
   S.multi = {primary, ids} ; S.selId reste l'élément « principal » (dernier cliqué).
   Toute autre façon de changer S.selId annule la sélection multiple (voir render). */
function isSel(id){ return S.multi ? S.multi.ids.indexOf(id)>=0 : id===S.selId; }
function treeOrder(){ var o=[]; walk(S.tree,function(n){ o.push(n.id); }); return o; }
/* éléments sélectionnés, dans l'ordre de l'arbre, sans ceux déjà inclus via un parent sélectionné */
function topLevelSelection(){
  var ids=S.multi?S.multi.ids:[S.selId], set={};
  ids.forEach(function(id){ set[id]=true; });
  return treeOrder().filter(function(id){
    if(!set[id]||id==="root") return false;
    for(var p=findParent(S.tree,id); p; p=findParent(S.tree,p.id)) if(set[p.id]) return false;
    return true;
  });
}
/* ajoute ou retire un élément de la sélection (Ctrl+clic hiérarchie, Maj/Ctrl+clic aperçu) */
function toggleInSelection(id){
  var ids=(S.multi?S.multi.ids:[S.selId]).filter(function(x){ return x!=="root"; }), k=ids.indexOf(id);
  if(k>=0) ids.splice(k,1); else ids.push(id);
  S.anchorId=id;
  if(ids.length>1){ S.multi={primary:k>=0?ids[ids.length-1]:id, ids:ids}; S.selId=S.multi.primary; }
  else { S.multi=null; S.selId=ids[0]||"root"; }
}
function treeClick(e,node){
  var mod=e.ctrlKey||e.metaKey;
  if(node.type!=="root" && e.shiftKey){
    var order=visibleOrder().filter(function(id){ return id!=="root"; });
    var a=order.indexOf(S.anchorId||S.selId), b=order.indexOf(node.id);
    if(a<0) a=b;
    S.multi={primary:node.id, ids:order.slice(Math.min(a,b),Math.max(a,b)+1)};
    S.selId=node.id;
  } else if(node.type!=="root" && mod){
    toggleInSelection(node.id);
  } else {
    S.multi=null; S.anchorId=node.id; S.selId=node.id;
  }
  render();
}
/* range les éléments sélectionnés dans un nouveau conteneur, placé à l'endroit du premier */
function wrapSelection(type){
  var nodes=topLevelSelection().map(function(id){ return findNode(S.tree,id); });
  if(!nodes.length) return;
  if(nodes.some(function(n){ return n.type==="treeitem"; })){ flash("Les TreeItem ne peuvent pas être groupés : ils doivent rester dans leur TreeView."); return; }
  if(nodes.some(function(n){ return n.type==="tab"; })){ flash("Les Tabs ne peuvent pas être groupés : ils doivent rester dans leur TabbedPanel."); return; }
  var first=nodes[0], parent=findParent(S.tree,first.id), idx=parent.children.indexOf(first);
  pushHistory();
  var wrap=makeNode(type), target = TAB_HOSTS[type] ? wrap.children[0] : wrap;
  if(!TAB_HOSTS[type]) wrap.props.orientation = parent.props.orientation==="row" ? "row" : "column";  // garde la disposition
  nodes.forEach(function(n){
    var p=findParent(S.tree,n.id);
    p.children.splice(p.children.indexOf(n),1);
    target.children.push(n);
  });
  parent.children.splice(idx,0,wrap);   // les éléments retirés de ce parent étaient tous après idx
  S.multi=null; S.selId=wrap.id; S.anchorId=wrap.id;
  flash(nodes.length+" élément"+(nodes.length>1?"s":"")+" placé"+(nodes.length>1?"s":"")+" dans un nouveau "+CONTROL_DEFS[type].label+" — Ctrl+Z pour annuler");
}
function removeSelection(){
  var ids=topLevelSelection(); if(!ids.length) return;
  var parent=findParent(S.tree,ids[0]);
  pushHistory();
  ids.forEach(function(id){ var p=findParent(S.tree,id); if(p) p.children=p.children.filter(function(c){ return c.id!==id; }); });
  S.multi=null; S.selId=parent&&findNode(S.tree,parent.id)?parent.id:"root";
  flash(ids.length+" éléments supprimés — Ctrl+Z pour annuler");
}
function duplicateSel(){ duplicateNodeById(S.selId); }

/* ---------- presse-papiers de contrôles ---------- */
function copySel(){
  var n=findNode(S.tree,S.selId);
  if(!n||n.type==="root"){ flash("Sélectionnez un contrôle à copier."); return; }
  S.clip=clone(n);
  flash((CONTROL_DEFS[n.type].label)+" copié — Ctrl+V pour coller dans le conteneur sélectionné");
}
function cutSel(){
  var n=findNode(S.tree,S.selId);
  if(!n||n.type==="root") return;
  S.clip=clone(n);
  removeNodeById(n.id);
}
/* colle dans le conteneur sélectionné, ou juste après le contrôle sélectionné */
function pasteClip(){
  if(!S.clip){ flash("Rien à coller : copiez d'abord un contrôle (Ctrl+C)."); return; }
  var sel=findNode(S.tree,S.selId)||S.tree, parent, index;
  if(S.clip.type==="tab"){
    parent = TAB_HOSTS[sel.type] ? sel : findTabHost(sel.id);
    if(parent && sel.type==="tab"){ index=parent.children.indexOf(sel)+1; }
  } else if(S.clip.type==="treeitem"){
    // TreeItem : dans le TreeView / TreeItem sélectionné, sinon dans le TreeView qui contient la sélection
    parent=findTreeHost(sel.id);
  } else if(TREE_HOSTS[sel.type]){
    // autre contrôle collé sur un TreeView ou un TreeItem : juste après le TreeView
    var tvw=sel; while(tvw.type==="treeitem") tvw=findParent(S.tree,tvw.id);
    parent=findParent(S.tree,tvw.id);
    if(parent) index=parent.children.indexOf(tvw)+1;
  } else if(TAB_HOSTS[sel.type]){
    parent=sel.children[Math.min(sel.props.selection|0,sel.children.length-1)];
  } else if(CONTAINER_TYPES.indexOf(sel.type)>=0){
    parent=sel;
  } else {
    parent=findParent(S.tree,sel.id);
    if(parent) index=parent.children.indexOf(sel)+1;
  }
  var err = (S.clip.type==="tab"&&!parent) ? "Un Tab ne peut être collé que dans un TabbedPanel."
          : (S.clip.type==="treeitem"&&!parent) ? "Un TreeItem ne peut être collé que dans un TreeView."
          : !parent ? "Ajoutez d'abord un Tab dans ce TabbedPanel."
          : canPlace(S.clip.type,parent);
  if(err){ flash(err); return; }
  if(index===undefined) index=parent.children.length;
  pushHistory();
  var copy=reId(clone(S.clip));
  parent.children.splice(index,0,copy);
  S.selId=copy.id;
  flash("Collé — pensez à donner un nom de variable unique");
}

/* ---------- navigation clavier dans la hiérarchie ---------- */
function visibleOrder(){
  var out=[];
  (function rec(n){ out.push(n.id); if(n.children&&!S.collapsed[n.id]) n.children.forEach(rec); })(S.tree);
  return out;
}
function selectStep(dir){
  var list=visibleOrder(), i=list.indexOf(S.selId);
  if(i<0 && S.proxyId) i=list.indexOf(S.proxyId);   // sélection cachée dans un groupe replié : partir de ce groupe
  var j=Math.max(0,Math.min(list.length-1,(i<0?0:i)+dir));
  if(list[j]!==S.selId){ S.selId=list[j]; render(); }
}

/* ============================================================
   DRAG & DROP — ciblage par emplacement (conteneur + index)
   Le conteneur survolé calcule l'interstice le plus proche du
   curseur : aucune précision requise, la barre s'y aimante.
   ============================================================ */
var DND={dragId:null,newType:null,copy:false,drop:null,targetEl:null};

function dndBusy(){ return !!(DND.dragId||DND.newType); }

/* --- barre d'insertion flottante --- */
var _bar=null, TRASH_EL=null;
/* Sécurité de suppression par glisser-déposer : il faut rester DELETE_ARM_MS au-dessus d'une zone de
   suppression (le vide autour de la fenêtre uniquement ; la case « Supprimer » reste immédiate) avant qu'un relâchement supprime.
   Relâcher avant = annulé. Une fois armée, la zone clignote. */
var DELETE_ARM_MS = 500;
var ARM={timer:null, armed:false};
function disarm(){
  clearTimeout(ARM.timer); ARM.timer=null; ARM.armed=false;
}
function clearTrash(){
  disarm();
  if(TRASH_EL){ TRASH_EL.classList.remove("over-del","over-dup","trashzone","arming","armed"); TRASH_EL=null; }
}
function bar(){
  if(!_bar){ _bar=document.createElement("div"); _bar.id="dropbar"; document.body.appendChild(_bar); }
  return _bar;
}
function hideBar(){
  if(_bar) _bar.style.display="none";
  if(DND.targetEl){ DND.targetEl.classList.remove("dz-target"); DND.targetEl=null; }
}
function showBar(rect,horiz,targetEl){
  clearTrash();          // sortie de la corbeille : retirer cadre rouge + bandeau
  var b=bar();
  b.className = horiz ? "v" : "h";
  b.style.display="block";
  if(horiz){ b.style.left=(rect.pos-2)+"px"; b.style.top=rect.start+"px"; b.style.width="4px"; b.style.height=Math.max(rect.len,8)+"px"; }
  else     { b.style.left=rect.start+"px"; b.style.top=(rect.pos-2)+"px"; b.style.height="4px"; b.style.width=Math.max(rect.len,8)+"px"; }
  if(DND.targetEl!==targetEl){
    if(DND.targetEl) DND.targetEl.classList.remove("dz-target");
    DND.targetEl=targetEl; targetEl.classList.add("dz-target");
  }
}
function markAction(el,action,cls){
  hideBar();
  if(DND.targetEl){ DND.targetEl.classList.remove("dz-target"); DND.targetEl=null; }
  if(TRASH_EL!==el){
    clearTrash(); TRASH_EL=el; el.classList.add(cls);
    if(action==="delete" && cls==="trashzone"){
      // armement : après DELETE_ARM_MS, la zone clignote pour signaler que relâcher supprimera
      el.classList.add("arming");
      ARM.timer=setTimeout(function(){
        ARM.timer=null; ARM.armed=true;
        if(TRASH_EL===el){ el.classList.remove("arming"); el.classList.add("armed"); }
      },DELETE_ARM_MS);
    }
  }
  DND.drop={action:action, needsArm:(action==="delete" && cls==="trashzone")};
}
function clearDropMark(){ hideBar(); clearTrash(); DND.drop=null; }
function endDrag(){ clearDropMark(); DND.dragId=null; DND.newType=null; DND.copy=false; }

/* le pointeur est-il assez à l'intérieur pour que ce conteneur revendique le survol ? */
function claimsPointer(e,rect){
  var ex=Math.max(4,Math.min(11,rect.width/3)), ey=Math.max(4,Math.min(11,rect.height/3));
  return e.clientX>rect.left+ex && e.clientX<rect.right-ex &&
         e.clientY>rect.top+ey && e.clientY<rect.bottom-ey;
}

/* interstice le plus proche parmi les enfants d'un conteneur */
function nearestSlot(e,kidRects,contRect,horiz){
  var p = horiz ? e.clientX : e.clientY;
  var n = kidRects.length, slots=[], i;
  if(!n){
    return {index:0,geom:{pos: horiz ? (contRect.left+contRect.right)/2 : (contRect.top+contRect.bottom)/2,
      start: horiz ? contRect.top+3 : contRect.left+3, len: horiz ? contRect.height-6 : contRect.width-6}};
  }
  function s(r){ return horiz ? r.left : r.top; }
  function ee(r){ return horiz ? r.right : r.bottom; }
  slots.push(s(kidRects[0]) - 3);
  for(i=1;i<n;i++) slots.push((ee(kidRects[i-1]) + s(kidRects[i]))/2);
  slots.push(ee(kidRects[n-1]) + 3);
  var best=0, bd=Math.abs(slots[0]-p);
  for(i=1;i<slots.length;i++){ var d=Math.abs(slots[i]-p); if(d<bd){ bd=d; best=i; } }
  var ref = kidRects[Math.min(best, n-1)];
  var crossStart = horiz ? Math.min(ref.top, contRect.top+2) : Math.min(ref.left, contRect.left+2);
  var crossLen  = horiz ? Math.max(ref.height, 14) : Math.max(ref.width, 14);
  return {index:best, geom:{pos:slots[best], start:crossStart, len:crossLen}};
}

/* --- déplacements / insertions --- */
function canPlace(kind,parentNode){
  if(!parentNode || !parentNode.children) return "Cet élément ne peut pas contenir de contrôles.";
  if(kind==="tab" && !TAB_HOSTS[parentNode.type]) return "Un Tab ne peut être déposé que dans un TabbedPanel (horizontal ou vertical).";
  if(TAB_HOSTS[parentNode.type] && kind!=="tab") return "Seuls des Tabs peuvent être enfants directs d'un panneau à onglets.";
  if(kind==="treeitem" && !TREE_HOSTS[parentNode.type]) return "Un TreeItem ne peut aller que dans un TreeView (ou dans un autre TreeItem).";
  if(TREE_HOSTS[parentNode.type] && kind!=="treeitem") return "Un TreeView ne contient que des TreeItem.";
  return null;
}
function performMoveTo(dragId,parentId,index){
  var dragNode=findNode(S.tree,dragId), destParent=findNode(S.tree,parentId);
  if(!dragNode||!destParent||dragId===parentId) return;
  if(findNode(dragNode,parentId)){ flash("Impossible de déposer un conteneur dans son propre enfant."); return; }
  var err=canPlace(dragNode.type,destParent); if(err){ flash(err); return; }
  var srcParent=findParent(S.tree,dragId); if(!srcParent) return;
  var srcIdx=0; srcParent.children.forEach(function(c,k){ if(c.id===dragId) srcIdx=k; });
  if(srcParent.id===destParent.id && (index===srcIdx || index===srcIdx+1)) return; // position inchangée
  pushHistory();
  srcParent.children.splice(srcIdx,1);
  if(srcParent.id===destParent.id && srcIdx<index) index--;
  destParent.children.splice(index,0,dragNode);
  S.selId=dragId; render();
}
function performInsertAt(type,parentId,index){
  var destParent=findNode(S.tree,parentId); if(!destParent) return;
  var err=canPlace(type,destParent); if(err){ flash(err); return; }
  pushHistory();
  var n=makeNode(type);
  destParent.children.splice(index,0,n);
  S.selId=n.id; render();
}
function performCopyTo(dragId,parentId,index){
  var dragNode=findNode(S.tree,dragId), destParent=findNode(S.tree,parentId);
  if(!dragNode||!destParent) return;
  if(findNode(dragNode,parentId)){ flash("Impossible de dupliquer un conteneur dans son propre enfant."); return; }
  var err=canPlace(dragNode.type,destParent); if(err){ flash(err); return; }
  pushHistory();
  var copy=reId(clone(dragNode));
  destParent.children.splice(index,0,copy);
  S.selId=copy.id; render();
  flash("Copie créée — pensez à lui donner un nom de variable unique");
}
function finishDrop(){
  var info=DND.drop, id=DND.dragId, type=DND.newType, copy=DND.copy, armed=ARM.armed;
  clearDropMark(); DND.dragId=null; DND.newType=null; DND.copy=false;
  if(!info) return;
  if(info.action){
    if(!id){ flash("Déposez ce contrôle dans la fenêtre pour l'ajouter."); return; }
    if(info.action==="delete" && info.needsArm && !armed){
      flash("Suppression annulée — maintenez l'élément "+(DELETE_ARM_MS/1000).toString().replace(".",",")+" s dans le vide autour de la fenêtre (le cadre clignote quand c'est prêt) avant de relâcher.");
      return;
    }
    if(info.action==="delete") removeNodeById(id);
    else if(info.action==="duplicate") duplicateNodeById(id);
    return;
  }
  if(type) performInsertAt(type,info.parentId,info.index);
  else if(id) (copy?performCopyTo:performMoveTo)(id,info.parentId,info.index);
}

/* --- source de glissement (un contrôle de l'aperçu) --- */
function attachDragSource(el,node){
  el.draggable=true;
  el.addEventListener("dragstart",function(e){
    e.stopPropagation();
    DND.dragId=node.id; DND.newType=null; DND.copy=!!e.altKey;   // Alt+Glisser = dupliquer
    try{ e.dataTransfer.setData("text/plain",node.id); e.dataTransfer.effectAllowed=DND.copy?"copy":"move"; }catch(err){}
    el.classList.add("pv-dragging");
  });
  el.addEventListener("dragend",function(e){ e.stopPropagation(); el.classList.remove("pv-dragging"); endDrag(); });
}

/* --- zone de dépôt (le contenu d'un conteneur) --- */
function zoneOver(e,contentEl,node,isRootZone){
  var r=contentEl.getBoundingClientRect();
  var kidRects=[], kids=contentEl.children, i, overKid=false;
  for(i=0;i<kids.length;i++) if(kids[i].__node){
    var kr=kids[i].getBoundingClientRect(); kidRects.push(kr);
    if(e.clientX>=kr.left&&e.clientX<=kr.right&&e.clientY>=kr.top&&e.clientY<=kr.bottom) overKid=true;
  }
  // trop près du bord : on laisse le conteneur parent gérer le placement en frère,
  // sauf si le curseur est sur un enfant (sinon impossible d'insérer avant le 1er / après le dernier)
  if(!isRootZone && !overKid && !claimsPointer(e,r)) return false;
  e.preventDefault(); e.stopPropagation();
  var horiz = node.type==="root" ? (S.tree.props.orientation==="row") : (node.props.orientation==="row");
  var slot=nearestSlot(e,kidRects,r,horiz);
  showBar(slot.geom,horiz,contentEl);
  DND.drop={parentId:node.id,index:slot.index};
  return true;
}
function attachDropZone(contentEl,node,isRootZone){
  contentEl.addEventListener("dragover",function(e){
    if(!dndBusy()) return;
    zoneOver(e,contentEl,node,isRootZone);
  });
  contentEl.addEventListener("drop",function(e){
    if(!dndBusy()) return;
    e.preventDefault(); e.stopPropagation();
    finishDrop();
  });
}

/* --- case d'action (corbeille / duplication) --- */
function attachActionZone(el,action,cls){
  el.addEventListener("dragover",function(e){
    if(!DND.dragId) return;           // rien à supprimer/dupliquer si ça vient de la palette
    e.preventDefault(); e.stopPropagation();
    markAction(el,action,cls);
  });
  el.addEventListener("dragleave",function(e){
    e.stopPropagation();
    if(TRASH_EL===el){ clearTrash(); DND.drop=null; }
  });
  el.addEventListener("drop",function(e){
    if(!dndBusy()) return;
    e.preventDefault(); e.stopPropagation();
    finishDrop();
  });
}

/* --- ligne de la hiérarchie : même moteur, converti en (parent, index) --- */
/* Position de dépôt dans la hiérarchie selon la hauteur du curseur dans la ligne :
   - contrôle simple : moitié haute = avant, moitié basse = après ;
   - conteneur : quart haut = avant, quart bas = après (ou 1er enfant s'il est déplié), milieu = dedans (à la fin). */
function treeDropTarget(e,row,node){
  var r=row.getBoundingClientRect(), y=(e.clientY-r.top)/(r.height||1);
  var isC=isContainer(node), zone;
  if(node.type==="root") zone="into";
  else if(!isC) zone = y<0.5 ? "before" : "after";
  else zone = y<0.25 ? "before" : y>0.75 ? "after" : "into";
  if(zone==="after" && isC && node.children.length && !S.collapsed[node.id]) zone="first";

  if(zone==="before"||zone==="after"){
    var par=findParent(S.tree,node.id); if(!par) return null;
    var k=par.children.indexOf(node);
    return {zone:zone,parentId:par.id,index:zone==="before"?k:k+1};
  }
  var target=node;
  // un TabbedPanel ne reçoit que des Tabs : les autres contrôles vont dans l'onglet actif
  var draggedType = DND.newType || (DND.dragId && findNode(S.tree,DND.dragId).type);
  if(TAB_HOSTS[node.type] && draggedType!=="tab"){
    var idx=Math.min(node.props.selection|0,Math.max(node.children.length-1,0));
    if(node.children[idx]) target=node.children[idx];
  }
  return {zone:zone,parentId:target.id,index:zone==="first"?0:target.children.length};
}
function attachTreeDnd(row,node){
  if(node.type!=="root") attachDragSource(row,node);
  row.addEventListener("dragover",function(e){
    if(!dndBusy() || DND.dragId===node.id) return;
    e.preventDefault(); e.stopPropagation();
    var drop=treeDropTarget(e,row,node);
    if(!drop) return;
    hideBar();
    var r=row.getBoundingClientRect();
    if(drop.zone==="into"){
      // dans le conteneur : on encadre la ligne au lieu d'afficher une barre
      if(DND.targetEl!==row){ if(DND.targetEl) DND.targetEl.classList.remove("dz-target"); DND.targetEl=row; row.classList.add("dz-target"); }
    } else {
      // barre avant / après, indentée au niveau où le contrôle atterrira
      var indent = drop.zone==="first" ? 20 : 0;
      showBar({pos:drop.zone==="before"?r.top:r.bottom, start:r.left+4+indent, len:r.width-8-indent}, false, row);
    }
    DND.drop={parentId:drop.parentId,index:drop.index};
  });
  row.addEventListener("drop",function(e){
    if(!dndBusy()) return;
    e.preventDefault(); e.stopPropagation();
    finishDrop();
  });
}

/* ============================================================
   CANEVAS : déplacement (molette enfoncée) et zoom
   ============================================================ */
var CANVAS_EL=null, CENTER_EL=null;

function applyTransform(){
  if(CANVAS_EL) CANVAS_EL.style.transform="translate("+S.pan.x+"px,"+S.pan.y+"px) scale("+S.zoom+")";
}
function resetView(){ S.pan={x:0,y:0}; S.zoom=1; render(); }
function setZoom(z,cx,cy){
  z=Math.max(0.35,Math.min(3,z));
  z=Math.round(z*100)/100;   // évite les échelles à décimales longues (sous-pixels flous)
  if(CENTER_EL && cx!==undefined){
    var r=CENTER_EL.getBoundingClientRect();
    var ox=r.left+r.width/2+S.pan.x, oy=r.top+r.height/2+S.pan.y;  // origine (centre du canevas)
    var ux=(cx-ox)/S.zoom, uy=(cy-oy)/S.zoom;                      // point sous le curseur
    S.pan.x = (cx - z*ux) - (r.left+r.width/2);
    S.pan.y = (cy - z*uy) - (r.top+r.height/2);
  }
  S.zoom=z;
  applyTransform();
  var hud=document.querySelector(".zoom-val");
  if(hud) hud.textContent=Math.round(S.zoom*100)+" %";
}

function attachCanvasNav(center,canvas){
  CANVAS_EL=canvas; CENTER_EL=center;
  var panning=false, sx=0, sy=0, spx=0, spy=0;

  function start(e){
    panning=true; sx=e.clientX; sy=e.clientY; spx=S.pan.x; spy=S.pan.y;
    center.classList.add("panning");
    canvas.classList.add("panning-layer");
    window.addEventListener("mousemove",move,true);
    window.addEventListener("mouseup",stop,true);
    e.preventDefault(); e.stopPropagation();
  }
  function move(e){
    if(!panning) return;
    S.pan.x=spx+(e.clientX-sx); S.pan.y=spy+(e.clientY-sy);
    applyTransform();
    e.preventDefault();
  }
  function stop(e){
    panning=false;
    center.classList.remove("panning");
    canvas.classList.remove("panning-layer");
    window.removeEventListener("mousemove",move,true);
    window.removeEventListener("mouseup",stop,true);
    if(e) e.preventDefault();
  }

  center.addEventListener("mousedown",function(e){
    if(e.button===1) start(e);                       // molette enfoncée
    else if(e.button===0 && S.spaceDown) start(e);   // Espace + clic gauche (portables)
  });
  center.addEventListener("auxclick",function(e){ if(e.button===1) e.preventDefault(); });
  center.addEventListener("mouseup",function(e){ if(e.button===1) e.preventDefault(); });

  // Molette : zoom uniquement. Le déplacement se fait au bouton central (ou Espace + clic).
  center.addEventListener("wheel",function(e){
    e.preventDefault();
    setZoom(S.zoom*(e.deltaY<0?1.12:1/1.12),e.clientX,e.clientY);
  },{passive:false});
}

/* ============================================================
   CHEMIN D'ITEM / MASQUAGE / SNAPSHOTS
   ============================================================ */
function nodePath(id){
  var names=computeNames(S.tree), chain=[], cur=findNode(S.tree,id);
  while(cur){ chain.unshift(names[cur.id]); cur=findParent(S.tree,cur.id); }
  return chain.join(".");
}
function nodeRef(id){ return computeNames(S.tree)[id]; }

function toggleHidden(id){
  var n=findNode(S.tree,id); if(!n||n.type==="root") return;
  pushHistory(); n.props.hidden=!n.props.hidden;
  flash(n.props.hidden ? (S.tree.props.hiddenAsComment ? "Item masqué : exporté en commentaire (toujours visible ici)" : "Item masqué : exclu du code généré (toujours visible ici)") : "Item réactivé");
}
function toggleCollapse(id){
  S.collapsed[id]=!S.collapsed[id]; render();
  if(!S.collapsed[id]) revealChildren(id);
}
/* Après un dépliage : défile juste assez pour montrer les enfants apparus sous le bas
   de la hiérarchie, sans jamais faire sortir la ligne du groupe par le haut. */
function revealChildren(id){
  var box=document.querySelector(".tree"), node=findNode(S.tree,id);
  if(!box||!node) return;
  var last=node;
  while(last.children&&last.children.length&&!S.collapsed[last.id]) last=last.children[last.children.length-1];
  var row=box.querySelector('[data-id="'+id+'"]'), lastRow=box.querySelector('[data-id="'+last.id+'"]');
  if(!row||!lastRow) return;
  var top=box.getBoundingClientRect().top-box.scrollTop;          // origine du contenu défilant
  var groupTop=row.getBoundingClientRect().top-top;
  var lastBottom=lastRow.getBoundingClientRect().bottom-top+4;
  if(lastBottom<=box.scrollTop+box.clientHeight) return;          // enfants déjà visibles : on ne bouge pas
  var target=Math.min(lastBottom-box.clientHeight, groupTop);     // le groupe reste en haut au pire
  if(target>box.scrollTop) box.scrollTop=target;
}

function snapshotAdd(){
  var name=prompt("Nom du snapshot :", S.tree.props.title+" — "+new Date().toLocaleTimeString().slice(0,5));
  if(name===null) return;
  S.snapshots.unshift({id:uid(),name:name||("Snapshot "+(S.snapshots.length+1)),
    date:new Date().toLocaleString(),tree:clone(S.tree)});
  flash("Snapshot enregistré ✓");
}
function snapshotLoad(id){
  var sn=null; S.snapshots.forEach(function(x){ if(x.id===id) sn=x; });
  if(!sn) return;
  var t=clone(sn.tree);
  try{ sanitizeTree(t); }catch(e){ flash("Snapshot illisible."); return; }
  pushHistory(); S.tree=t; S.selId="root"; S.snapOpen=false;
  flash("Snapshot « "+sn.name+" » chargé (Ctrl+Z pour revenir)");
}
function snapshotDelete(id){
  S.snapshots=S.snapshots.filter(function(x){ return x.id!==id; });
  render();
}

/* ---------- fichiers ---------- */
function baseName(){ return (S.tree.props.title||"ui_script").replace(/[^\w\-]/g,"_"); }
function download(content,filename){
  var blob=new Blob([content],{type:"text/plain;charset=utf-8"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
}
function copyText(txt,btn){
  function done(){ if(btn){ var o=btn.textContent; btn.textContent="✓ Copié"; setTimeout(function(){ btn.textContent=o; },1400); } }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done,function(){ legacy(); });
  } else legacy();
  function legacy(){
    var ta=document.createElement("textarea"); ta.value=txt;
    ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy"); done(); }catch(e){}
    document.body.removeChild(ta);
  }
}
/* snapshots venant d'un fichier : arbres normalisés, invalides écartés */
function validSnapshots(list){
  return (list||[]).filter(function(sn){
    try{ sanitizeTree(sn.tree); sn.id=uid(); sn.name=String(sn.name||"Snapshot"); sn.date=String(sn.date||""); return true; }
    catch(e){ return false; }
  });
}
/* Ouvre une maquette : .json exporté, ou .jsx / resource contenant la ligne « // @scriptui-dialog-designer » (ou l'ancienne « // @scriptui-designer ») */
function importModelFile(file){
  var reader=new FileReader();
  reader.onload=function(){
    var text=String(reader.result), data;
    try{
      data = /^\s*\{/.test(text) ? JSON.parse(text) : extractModel(text);
      if(!data){ flash("Ce fichier ne contient pas de maquette : seuls les .jsx exportés par la v"+APP_VERSION+"+ (option « Intégrer la maquette ») sont réimportables."); return; }
      var t=data.tree||data;
      var removed=sanitizeTree(t);
      var snaps=validSnapshots(data.snapshots);
      pushHistory();
      S.tree=t; S.selId="root"; S.collapsed={};
      if(snaps.length) S.snapshots=snaps.concat(S.snapshots);
      flash("Maquette importée ✓"+(snaps.length?" ("+snaps.length+" snapshot(s))":"")+
        (removed?" — "+removed+" item(s) inconnu(s) ou mal placé(s) ignoré(s)":""));
    }catch(e){ flash("Import impossible : fichier de maquette invalide."); }
  };
  reader.readAsText(file);
}

/* ============================================================
   RENDU
   ============================================================ */
function buildPreviewNode(node,parentOrientation){
  var pr=node.props, test=S.mode==="test";
  var sel=!test&&isSel(node.id);
  var st={};
  applySelfAlign(st,pr,parentOrientation);
  sizeCss(pr,st);
  if(FONT_TYPES[node.type] && node.type!=="panel") fontCss(pr,st);
  if(sel){ st.outline="1px solid var(--accent)"; st.outlineOffset="2px"; st.borderRadius="2px"; }
  if(pr.enabled===false) st.opacity="0.45";
  function click(e){ if(test) return; e.stopPropagation(); selectFromPreview(node.id,e); }
  function testSet(key,val){ if(pr.enabled===false) return; pr[key]=val; render(); }   // mode Test : copie jetable, pas d'historique

  switch(node.type){
    case "group": {
      var gs=assign(containerStyle(node),st);
      if(!node.children.length) gs.minHeight="24px";
      var g=h("div",{class:"pv-group",style:gs,onclick:click,title:pr.helpTip});
      node.children.forEach(function(c){ var el=renderPreviewNode(c,pr.orientation); if(el) g.appendChild(el); });
      if(!node.children.length) g.appendChild(h("span",{class:"pv-empty",text:"group vide"}));
      g.__content=g;
      return g;
    }
    case "panel": {
      var fs=h("fieldset",{class:"pv-panel bs-"+(pr.borderStyle||"etched"),style:st,onclick:click,title:pr.helpTip},h("legend",{text:pr.text,style:fontCss(pr,{})}));
      var inner=h("div",{style:containerStyle(node)});
      node.children.forEach(function(c){ var el=renderPreviewNode(c,pr.orientation); if(el) inner.appendChild(el); });
      if(!node.children.length) inner.appendChild(h("span",{class:"pv-empty",text:"panel vide"}));
      fs.appendChild(inner); fs.__content=inner; return fs;
    }
    case "tabbedpanel": {
      var selIdx=Math.min(pr.selection|0,Math.max(node.children.length-1,0));
      var active=node.children[selIdx];
      var wrap=h("div",{class:"pv-tp",style:st,onclick:click,title:pr.helpTip});
      var strip=h("div",{class:"pv-tp-strip"});
      node.children.forEach(function(t,i){
        strip.appendChild(h("span",{class:"pv-tp-tab"+(i===selIdx?" on":""),text:t.props.text,
          onclick:function(e){
            e.stopPropagation();
            if(!test){ if((pr.selection|0)!==i){ pushHistory(); pr.selection=i; } S.selId=t.id; S.noExpand=true; }
            else pr.selection=i;
            render();
          }}));
      });
      wrap.appendChild(strip);
      var body=h("div",{class:"pv-tp-body"});
      if(active){
        var inner2=h("div",{style:containerStyle(active)});
        active.children.forEach(function(c){ var el=renderPreviewNode(c,active.props.orientation); if(el) inner2.appendChild(el); });
        if(!active.children.length) inner2.appendChild(h("span",{class:"pv-empty",text:"onglet vide"}));
        body.appendChild(inner2);
        if(S.mode==="edit") attachDropZone(inner2,active,false);
      } else body.appendChild(h("span",{class:"pv-empty",text:"ajoutez des onglets (Tab)"}));
      wrap.appendChild(body); return wrap;
    }
    case "verticaltabbedpanel": {
      // liste de navigation à gauche (comme la ListBox du code exporté), page active à droite
      var vIdx=Math.min(pr.selection|0,Math.max(node.children.length-1,0)), vActive=node.children[vIdx];
      var vwrap=h("div",{class:"pv-vtp",style:st,onclick:click,title:pr.helpTip});
      var nav=h("div",{class:"pv-list pv-vtp-nav",style:{width:((pr.tabNavWidth|0)>0?(pr.tabNavWidth|0):110)+"px"}});
      node.children.forEach(function(t,i){
        nav.appendChild(h("div",{class:"pv-list-row"+(i===vIdx?" on":""),
          onclick:function(e){
            e.stopPropagation();
            if(!test){ if((pr.selection|0)!==i){ pushHistory(); pr.selection=i; } S.selId=t.id; S.noExpand=true; }
            else pr.selection=i;
            render();
          }},h("span",{text:t.props.text})));
      });
      vwrap.appendChild(nav);
      var vbody=h("div",{class:"pv-vtp-body"});
      if(vActive){
        var vin=h("div",{style:containerStyle(vActive)});
        vActive.children.forEach(function(c){ var el=renderPreviewNode(c,vActive.props.orientation); if(el) vin.appendChild(el); });
        if(!vActive.children.length) vin.appendChild(h("span",{class:"pv-empty",text:"page vide"}));
        vbody.appendChild(vin);
        if(S.mode==="edit") attachDropZone(vin,vActive,false);
      } else vbody.appendChild(h("span",{class:"pv-empty",text:"ajoutez des onglets (Tab)"}));
      vwrap.appendChild(vbody); return vwrap;
    }
    case "tab": return null;
    case "statictext":
      st.whiteSpace=pr.multiline?"pre-wrap":"nowrap"; st.textAlign=pr.justify;
      if(pr.width>0) st.width=pr.width+"px";
      var shown=String(pr.text);
      // truncate : n'agit que si le texte déborde d'une largeur fixe (comme dans ScriptUI)
      if(!pr.multiline&&pr.width>0&&pr.truncate==="end"){ st.overflow="hidden"; st.textOverflow="ellipsis"; }
      if(!pr.multiline&&pr.width>0&&pr.truncate==="middle"){
        var maxC=Math.max(4,Math.floor(pr.width/6.6));
        if(shown.length>maxC){ var half=Math.floor((maxC-1)/2); shown=shown.slice(0,half)+"…"+shown.slice(shown.length-(maxC-1-half)); }
        st.overflow="hidden";
      }
      return h("span",{class:"pv-static",style:st,text:shown,onclick:click,title:pr.helpTip||(shown!==pr.text?pr.text:"")});
    case "edittext": {
      var w = pr.width>0 ? pr.width+"px" : (pr.alignment==="fill"?null:((pr.characters|0)*7+14)+"px");
      if(w) st.width=w;
      var editable = test && !pr.readonly && pr.enabled!==false;
      if(pr.multiline){
        st.height=(pr.height>0?pr.height:60)+"px";
        var ta=h("textarea",{class:"pv-edit",style:st,title:pr.helpTip,onclick:click});
        ta.value=pr.text; ta.readOnly=!editable;
        if(editable) ta.oninput=function(){ pr.text=ta.value; };
        return ta;
      }
      var inp=h("input",{class:"pv-edit",style:st,title:pr.helpTip,onclick:click,
        type:(pr.noecho&&test)?"password":"text"});
      inp.value = (pr.noecho&&!test) ? new Array((pr.text||"").length||6).join("•")+"•" : pr.text;
      inp.readOnly=!editable;
      if(editable) inp.oninput=function(){ pr.text=inp.value; };
      return inp;
    }
    case "button":
      if(pr.width>0) st.minWidth=pr.width+"px";
      if(pr.height>0) st.height=pr.height+"px";
      return h("button",{class:"pv-btn",style:st,text:pr.text,title:pr.helpTip,
        onclick:function(e){ e.stopPropagation(); if(test) flash("▶ "+computeNames(S.tree)[node.id]+".onClick() simulé"); else { selectFromPreview(node.id,e); } }});
    case "iconbutton":
      // image intégrée : affichée à sa taille réelle (ScriptUI ne redimensionne pas les icônes)
      if(pr.imageData){ if(pr.width>0) st.width=pr.width+"px"; if(pr.height>0) st.height=pr.height+"px"; }
      else { st.width=(pr.width>0?pr.width:34)+"px"; st.height=(pr.height>0?pr.height:30)+"px"; }
      return h("button",{class:"pv-iconbtn"+(pr.style==="toolbutton"?" tool":""),style:st,title:pr.helpTip||pr.imageName||pr.imagePath,
        onclick:function(e){ e.stopPropagation(); if(test) flash("▶ "+computeNames(S.tree)[node.id]+".onClick() simulé"); else { selectFromPreview(node.id,e); } }},
        pr.imageData ? h("img",{src:pr.imageData,alt:"",class:"pv-img",draggable:"false"}) : "▩");
    case "image":
      if(pr.imageData){
        if(pr.width>0) st.width=pr.width+"px"; if(pr.height>0) st.height=pr.height+"px";
        return h("div",{class:"pv-image real",style:st,onclick:click,title:pr.helpTip||pr.imageName},
          h("img",{src:pr.imageData,alt:"",class:"pv-img",draggable:"false"}));
      }
      st.width=(pr.width>0?pr.width:90)+"px"; st.height=(pr.height>0?pr.height:54)+"px";
      return h("div",{class:"pv-image",style:st,onclick:click,title:pr.helpTip||pr.imagePath},
        h("span",{text:"▨"}), h("em",{text:String(pr.imagePath).split(/[\\\/]/).pop()}));
    case "checkbox":
      st.cursor=test?"pointer":"default";
      return h("label",{class:"pv-check",style:st,title:pr.helpTip,
        onclick:function(e){ e.stopPropagation(); if(test) testSet("value",!pr.value); else { selectFromPreview(node.id,e); } }},
        h("span",{class:"pv-box"+(pr.value?" on":""),text:pr.value?"✓":""}), pr.text);
    case "radiobutton":
      st.cursor=test?"pointer":"default";
      return h("label",{class:"pv-check",style:st,title:pr.helpTip,
        onclick:function(e){
          e.stopPropagation();
          if(test){ if(pr.enabled===false) return; var p=findParent(viewTree(),node.id);
            p.children.forEach(function(c){ if(c.type==="radiobutton") c.props.value=(c.id===node.id); }); render(); }
          else { selectFromPreview(node.id,e); }
        }},
        h("span",{class:"pv-radio"},pr.value?h("i",{}):null), pr.text);
    case "dropdownlist": {
      var items=String(pr.items).split(",").map(function(s){return s.trim();});
      var si=Math.min(pr.selection|0,items.length-1);
      if(pr.width>0) st.width=pr.width+"px";
      if(test){
        var sel2=h("select",{class:"pv-dd-real",style:st,title:pr.helpTip,onclick:function(e){e.stopPropagation();}});
        items.forEach(function(it,i){
          var o=h("option",{value:i,text:it==="-"?"────────":it}); if(it==="-") o.disabled=true; sel2.appendChild(o);
        });
        sel2.value=si; sel2.disabled=pr.enabled===false;
        sel2.onchange=function(){ testSet("selection",Number(sel2.value)); };
        return sel2;
      }
      return h("span",{class:"pv-dd",style:st,onclick:click,title:pr.helpTip},
        h("span",{class:"pv-dd-txt",text:items[si]==="-"?"":(items[si]||"")}), h("span",{class:"pv-dd-ar",text:"▾"}));
    }
    case "listbox": {
      var rows=parseListRows(pr.items), nCols=Math.max(pr.numberOfColumns|0,1);
      var titles=String(pr.columnTitles).split(",").map(function(s){return s.trim();});
      st.height=(pr.height>0?pr.height:80)+"px";
      if(pr.width>0) st.width=pr.width+"px";
      var box=h("div",{class:"pv-list",style:st,onclick:click,title:pr.helpTip});
      if(nCols>1&&pr.showHeaders){
        var head=h("div",{class:"pv-list-row pv-list-head",style:{gridTemplateColumns:gridCols(pr,nCols)}});
        for(var ci=0;ci<nCols;ci++) head.appendChild(h("span",{text:titles[ci]||""}));
        box.appendChild(head);
      }
      rows.forEach(function(cells,i){
        var r=h("div",{class:"pv-list-row"+(i===(pr.selection|0)?" on":""),
          style:{gridTemplateColumns:nCols>1?gridCols(pr,nCols):"1fr"},
          onclick:function(e){ if(test){ e.stopPropagation(); testSet("selection",i); } }});
        if(nCols>1){ for(var c2=0;c2<nCols;c2++) r.appendChild(h("span",{text:cells[c2]||""})); }
        else r.appendChild(h("span",{text:cells[0]}));
        box.appendChild(r);
      });
      return box;
    }
    case "treeview": {
      st.height=(pr.height>0?pr.height:110)+"px";
      if(pr.width>0) st.width=pr.width+"px";
      var tv=h("div",{class:"pv-list",style:st,onclick:click,title:pr.helpTip});
      // éléments = TreeItem de la hiérarchie ; clic = sélection (Édition) ou déplier/replier (Test)
      (function rows(items,depth){
        items.forEach(function(it){
          var kids=it.children||[], isNode=kids.length>0, open=it.props.expanded!==false;
          var rowEl=h("div",{class:"pv-list-row"+(isNode?" pv-node":"")+(!test&&isSel(it.id)?" on":"")+(it.props.hidden?" pv-hidden":""),
            style:{paddingLeft:(8+depth*16)+"px"},
            onclick:function(e){
              e.stopPropagation();
              if(test){ if(isNode){ it.props.expanded=!open; render(); } }
              else selectFromPreview(it.id,e);
            }},
            h("span",{text:(isNode?(open?"▾ ":"▸ "):"")+it.props.text}));
          tv.appendChild(rowEl);
          if(isNode&&open) rows(kids,depth+1);
        });
      })(node.children||[],0);
      if(!(node.children||[]).length) tv.appendChild(h("div",{class:"pv-empty",text:"ajoutez des TreeItem"}));
      return tv;
    }
    case "treeitem": return null;   // dessiné par son TreeView
    case "slider": case "scrollbar": {
      if(test){
        st.width=(pr.width>0?pr.width:140)+"px";
        var rg=h("input",{class:"pv-range",type:"range",style:st,min:pr.min,max:pr.max,
          title:(pr.helpTip||"")+" ("+pr.value+")",onclick:function(e){e.stopPropagation();}});
        rg.value=pr.value; rg.disabled=pr.enabled===false;
        rg.oninput=function(){ pr.value=Number(rg.value); rg.title=(pr.helpTip||"")+" ("+pr.value+")"; };
        return rg;
      }
      var pct=((pr.value-pr.min)/((pr.max-pr.min)||1))*100;
      if(pr.width>0) st.width=pr.width+"px";
      if(node.type==="slider"){
        return h("div",{class:"pv-slider",style:st,onclick:click,title:pr.helpTip},
          h("div",{class:"pv-track"},h("div",{class:"pv-thumb",style:{left:"calc("+pct+"% - 6px)"}})));
      }
      return h("div",{class:"pv-scroll",style:st,onclick:click,title:pr.helpTip},
        h("span",{class:"pv-scroll-btn",text:"◂"}),
        h("div",{class:"pv-scroll-track"},h("div",{class:"pv-scroll-thumb",style:{left:Math.min(pct,82)+"%"}})),
        h("span",{class:"pv-scroll-btn",text:"▸"}));
    }
    case "progressbar": {
      if(pr.width>0) st.width=pr.width+"px";
      return h("div",{class:"pv-prog",style:st,onclick:click,title:pr.helpTip},
        h("div",{class:"pv-prog-fill",style:{width:((pr.value/(pr.max||1))*100)+"%"}}));
    }
    case "divider":
      if(pr.width>0) st.width=pr.width+"px";
      return h("div",{class:"pv-divider",style:st,onclick:click,title:pr.helpTip});
    case "dividerv":
      if(pr.height>0) st.height=pr.height+"px";
      return h("div",{class:"pv-divider-v",style:st,onclick:click,title:pr.helpTip});
    case "custom": {
      st.width=(pr.width>0?pr.width:120)+"px"; st.height=(pr.height>0?pr.height:28)+"px";
      st.background=pr.fillColor; st.color=pr.textColor;
      var cu=h("div",{class:"pv-custom"+(pr.clickable?" clickable":""),style:st,text:pr.text,title:pr.helpTip,
        onclick:function(e){ e.stopPropagation();
          if(test){ if(pr.clickable&&pr.enabled!==false) flash("▶ "+computeNames(S.tree)[node.id]+' « click » simulé'); }
          else { selectFromPreview(node.id,e); } }});
      if(test&&pr.clickable&&pr.enabled!==false){
        cu.onmouseenter=function(){ cu.style.background=pr.hoverColor; };
        cu.onmouseleave=function(){ cu.style.background=pr.fillColor; };
      }
      return cu;
    }
  }
  return null;
}

/* Wrapper : source de glissement + zone de dépôt en mode Édition */
function renderPreviewNode(node,parentOrientation){
  var el=buildPreviewNode(node,parentOrientation);
  if(!el) return el;
  el.__node=node;
  if(node.props.hidden) el.classList.add("pv-hidden");
  if(S.mode==="edit" && node.type!=="tab"){
    attachDragSource(el,node);
    if(el.__content) attachDropZone(el.__content,node,false);
    if(el.tagName==="INPUT"||el.tagName==="TEXTAREA") el.style.userSelect="none";
    el.addEventListener("contextmenu",function(e){ openCtx(e,node); });
  }
  return el;
}

/* ---------- menu contextuel (clic droit) ---------- */
function openCtx(e,node){
  e.preventDefault(); e.stopPropagation();
  if(S.multi && isSel(node.id)) S.multi.primary=node.id;   // clic droit dans la sélection multiple : on la garde
  else S.multi=null;
  S.selId=node.id;
  S.ctx={x:e.clientX,y:e.clientY,id:node.id};
  render();
}
function renderCtxMenu(){
  var node=findNode(S.tree,S.ctx.id); if(!node){ S.ctx=null; return null; }
  if(S.multi){
    var mm=h("div",{class:"ctx-menu",style:{left:Math.min(S.ctx.x,window.innerWidth-230)+"px",
      top:Math.min(S.ctx.y,window.innerHeight-200)+"px"},onclick:function(e){ e.stopPropagation(); }});
    var n=S.multi.ids.length;
    [["Grouper dans un Group","Ctrl+G",function(){ wrapSelection("group"); }],
     ["Grouper dans un Panel",null,function(){ wrapSelection("panel"); }],
     ["Grouper dans un TabbedPanel",null,function(){ wrapSelection("tabbedpanel"); }],
     null,
     ["Supprimer les "+n+" éléments","Suppr",function(){ removeSelection(); },"danger"]].forEach(function(it){
      if(!it){ mm.appendChild(h("div",{class:"ctx-sep"})); return; }
      mm.appendChild(h("button",{class:it[3]||"",onclick:function(){ S.ctx=null; it[2](); }},
        h("span",{text:it[0]}), it[1]?h("kbd",{text:it[1]}):null));
    });
    return mm;
  }
  var isRoot=node.type==="root";
  var isC=isContainer(node);
  var m=h("div",{class:"ctx-menu",style:{left:Math.min(S.ctx.x,window.innerWidth-230)+"px",
    top:Math.min(S.ctx.y,window.innerHeight-360)+"px"},onclick:function(e){ e.stopPropagation(); }});
  function item(label,kbd,fn,cls){
    m.appendChild(h("button",{class:cls||"",onclick:function(){ S.ctx=null; fn(); }},
      h("span",{text:label}), kbd?h("kbd",{text:kbd}):null));
  }
  item("Copier la référence  ("+nodeRef(node.id)+")",null,function(){ copyText(nodeRef(node.id)); flash("Référence copiée : "+nodeRef(node.id)); });
  item("Copier le chemin complet",null,function(){ var p=nodePath(node.id); copyText(p); flash("Chemin copié : "+p); });
  if(!isRoot){
    m.appendChild(h("div",{class:"ctx-sep"}));
    item("Copier","Ctrl+C",function(){ S.selId=node.id; copySel(); });
    item("Couper","Ctrl+X",function(){ S.selId=node.id; cutSel(); });
    item("Dupliquer","Ctrl+D",function(){ S.selId=node.id; duplicateSel(); });
    item(node.props.hidden?"Réafficher dans l'export":"Masquer (exclure de l'export)",null,function(){ toggleHidden(node.id); });
  }
  if(S.clip){
    if(isRoot) m.appendChild(h("div",{class:"ctx-sep"}));
    item((isC?"Coller dedans":"Coller après")+"  ("+CONTROL_DEFS[S.clip.type].label+")","Ctrl+V",function(){ S.selId=node.id; pasteClip(); });
  }
  if(isC){
    m.appendChild(h("div",{class:"ctx-sep"}));
    item(S.collapsed[node.id]?"Déplier":"Replier","Double-clic",function(){ toggleCollapse(node.id); });
  }
  if(!isRoot){
    m.appendChild(h("div",{class:"ctx-sep"}));
    item("Supprimer","Suppr",function(){ S.selId=node.id; removeSel(); },"danger");
  }
  return m;
}

/* Clic dans l'aperçu : sélectionne sans déplier la hiérarchie (le groupe replié qui contient
   l'élément est seulement mis en évidence). Le double-clic, lui, déplie (sélection normale). */
var _lastPvClick={id:null,t:0};
function selectFromPreview(id,e){
  // Ctrl+clic (Cmd sur Mac) : ajouter / retirer de la sélection ; Maj+clic = clic normal dans l'aperçu
  if(e && (e.ctrlKey||e.metaKey) && id!=="root"){
    _lastPvClick={id:null,t:0};
    toggleInSelection(id);
    S.noExpand=true; render();
    return;
  }
  // double-clic détecté à la main : chaque clic reconstruit l'aperçu, l'événement dblclick natif n'est pas fiable
  var now=Date.now(), dbl=_lastPvClick.id===id && now-_lastPvClick.t<400;
  _lastPvClick={id:dbl?null:id,t:now};
  if(dbl){ S.multi=null; revealSelection(id); return; }
  S.multi=null; S.anchorId=id; S.selId=id; S.noExpand=true; render();
}
function revealSelection(id){ S.selId=id; S.lastRevealed=null; render(); }   // force le dépliage même si déjà sélectionné
/* groupe replié le plus haut qui cache la sélection (sa ligne est visible), ou null */
function hiddenSelAncestor(){
  var found=null, p=findParent(S.tree,S.selId);
  while(p){ if(S.collapsed[p.id]) found=p; p=findParent(S.tree,p.id); }
  return found;
}
function expandAncestors(id){
  var p=findParent(S.tree,id);
  while(p){ S.collapsed[p.id]=false; p=findParent(S.tree,p.id); }
}
/* fait défiler la hiérarchie au minimum pour que la ligne soit entièrement visible */
function scrollRowIntoView(box,id){
  var row=box.querySelector('.tree-row[data-id="'+id+'"]');
  if(!row) return;
  var br=box.getBoundingClientRect(), rr=row.getBoundingClientRect();
  if(rr.top<br.top) box.scrollTop-=br.top-rr.top+4;
  else if(rr.bottom>br.bottom) box.scrollTop+=rr.bottom-br.bottom+4;
}
function countDescendants(node){
  var n=0; (node.children||[]).forEach(function(c){ n+=1+countDescendants(c); }); return n;
}
function renderTreeRows(node,depth,out){
  var def = node.type==="root" ? {icon:"🗔"} : CONTROL_DEFS[node.type];
  var label = node.props.text||node.props.title||node.props.name||"";
  var isRoot = node.type==="root";
  var isC=isContainer(node);
  var hasKids=node.children&&node.children.length;
  var holdsSel = node.id===S.proxyId;   // groupe replié qui contient la sélection
  var cls="tree-row"+(isSel(node.id)?" sel":"")+(holdsSel?" holds-sel":"")+(node.props.hidden?" hidden":"");
  var row=h("div",{class:cls,style:{paddingLeft:(6+depth*14)+"px"},role:"treeitem",tabindex:"0","data-id":node.id,
    "aria-selected":node.id===S.selId?"true":"false","aria-expanded":(isC&&hasKids)?String(!S.collapsed[node.id]):null,
    onclick:function(e){ treeClick(e,node); },
    ondblclick:function(e){ e.stopPropagation(); if(isC&&hasKids) toggleCollapse(node.id); },
    oncontextmenu:function(e){ openCtx(e,node); },
    title: holdsSel ? "Contient l'élément sélectionné — double-clic pour déplier" : null
  },
    (isC&&hasKids)
      ? h("span",{class:"tree-caret has"+(S.collapsed[node.id]?"":" open"),
          title:(S.collapsed[node.id]?"Déplier":"Replier")+" ("+node.children.length+" élément"+(node.children.length>1?"s":"")+")",
          html:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
          onclick:function(e){ e.stopPropagation(); toggleCollapse(node.id); }})
      : h("span",{class:"tree-caret"}),
    h("span",{class:"tree-ic",text:def.icon}),
    h("span",{class:"tree-type",text:isRoot?"window":node.type}),
    label?h("span",{class:"tree-lbl",text:"“"+(label.length>14?label.slice(0,14)+"…":label)+"”"}):null,
    (isC&&hasKids&&S.collapsed[node.id])?h("span",{class:"tree-count",title:"Éléments repliés",text:"+"+countDescendants(node)}):null,
    node.props.hidden?h("span",{class:"tree-eye",text:"masqué"}):null,
    !isRoot?h("span",{class:"tree-grip",text:"⋮⋮"}):null
  );
  attachTreeDnd(row,node);
  out.appendChild(row);
  if(node.children && !S.collapsed[node.id]) node.children.forEach(function(c){ renderTreeRows(c,depth+1,out); });
}

/* ---------- inspecteur ---------- */
var COMMON_FIELDS=[
  ["alignment","Alignment (dans le parent)","select",ALIGN_SELF],
  ["alignV","Alignement vertical — optionnel, génère [H, V]","select",["","top","center","bottom","fill"]],
  ["helpTip","Info-bulle (helpTip)","text"],
  ["enabled","Activé (enabled)","checkbox"],
  ["size","preferredSize — L × H (0 = auto)","pair",["width","height"]],
  ["minSize","minimumSize — L × H (0 = aucun)","pair",["minWidth","minHeight"]],
  ["maxSize","maximumSize — L × H (0 = aucun)","pair",["maxWidth","maxHeight"]]
];
var FONT_FIELDS=[
  ["fontStyle","Police — style (graphics.font)","select",["","REGULAR","BOLD","ITALIC","BOLDITALIC"]],
  ["fontSize","Police — taille en pt (0 = défaut)","number"]
];
var FIELDS={
  root:[["","Fenêtre","heading"],["targetApp","Application cible","select",TARGET_OPTIONS],["title","Titre de la fenêtre","text"],["winType","Type","select",["dialog","palette","window","dockable"]],
    ["closeButton","Bouton de fermeture (closeButton — ignoré pour dialog)","checkbox"],
    ["minimizeButton","Bouton réduire (minimizeButton — palette/window)","checkbox"],
    ["maximizeButton","Bouton agrandir (maximizeButton — palette/window)","checkbox"],
    ["borderless","Sans bordure ni barre de titre (borderless)","checkbox"],
    ["independent","Fenêtre indépendante (independent — type « window » uniquement, Windows)","checkbox"],
    ["su1PanelCoordinates","Coordonnées des panneaux à l'ancienne (su1PanelCoordinates — Photoshop)","checkbox"],
    ["","Disposition","heading"],["orientation","Orientation","select",["column","row","stack"]],
    ["alignChildren","alignChildren","select",["left","center","right","top","bottom","fill"]],
    ["spacing","Spacing (px)","number"],["margins","Margins (px)","number"],
    ["resizeable","Redimensionnable (palette / window / dockable)","checkbox"],
    ["","Code généré","heading"],["genHandlers","Générer les handlers onChange/onChanging","checkbox"],
    ["genSettings","Générer win.getSettings()","checkbox"],
    ["persistSettings","Mémoriser les valeurs entre les sessions (fichier de réglages)","checkbox"],
    ["localize","Localisation EN/FR (localize)","checkbox"],
    ["","Export","heading"],
    ["exportShow","Afficher la fenêtre à la fin du script (show)","checkbox"],
    ["exportWrapper","Envelopper dans une fonction (variables isolées)","checkbox"],
    ["indentSize","Indentation","select",[["4","4 espaces"],["2","2 espaces"]]],
    ["refList","Liste des références des contrôles nommés (fin du code)","checkbox"],
    ["hiddenAsComment","Éléments masqués : les exporter en commentaire (au lieu de les retirer)","checkbox"],
    ["embedModel","Intégrer la maquette au .jsx (réimportable)","checkbox"]],
  group:[["orientation","Orientation","select",["row","column","stack"]],
    ["alignChildren","alignChildren","select",["left","center","right","top","bottom","fill"]],
    ["spacing","Spacing (px)","number"],["margins","Margins (px)","number"]],
  panel:[["text","Titre du panneau","text",null,"loc"],
    ["borderStyle","Bordure (borderStyle)","select",["etched","sunken","raised","black","gray","topDivider"]],
    ["orientation","Orientation","select",["column","row","stack"]],
    ["alignChildren","alignChildren","select",["left","center","right","top","bottom","fill"]],
    ["spacing","Spacing (px)","number"],["margins","Margins (px)","number"]],
  tabbedpanel:[["selection","Onglet actif (index)","number"],["name","Nom de variable (JS)","text"]],
  verticaltabbedpanel:[["selection","Onglet actif (index)","number"],["tabNavWidth","Largeur de la liste d'onglets (0 = 110 px)","number"],["name","Nom de variable (JS)","text"]],
  tab:[["text","Titre de l'onglet","text",null,"loc"],["orientation","Orientation","select",["column","row","stack"]],
    ["alignChildren","alignChildren","select",["left","center","right","top","bottom","fill"]],
    ["spacing","Spacing (px)","number"],["margins","Margins (px)","number"]],
  statictext:[["text","Texte","text",null,"loc"],["multiline","Multiligne","checkbox"],
    ["splitLines","Multiligne : exporter une ligne = un StaticText (plus fiable)","checkbox"],
    ["justify","Justification (justify)","select",["left","center","right"]],
    ["truncate","Troncature si trop long (truncate — avec largeur fixe)","select",["none","middle","end"]]],
  edittext:[["text","Valeur par défaut","text"],["name","Nom de variable (JS)","text"],
    ["characters","Largeur (caractères)","number"],["multiline","Multiligne","checkbox"],
    ["readonly","Lecture seule (readonly)","checkbox"],["noecho","Masqué / mot de passe (noecho)","checkbox"],
    ["justify","Justification (justify)","select",["left","center","right"]],["active","Focus à l'ouverture (active)","checkbox"],
    ["enterKeySignalsOnChange","ENTRÉE déclenche onChange (enterKeySignalsOnChange)","checkbox"],
    ["wantReturn","ENTRÉE insère un saut de ligne (wantReturn — multiligne)","checkbox"]],
  custom:[["text","Texte dessiné","text",null,"loc"],["name","Nom de variable (JS)","text"],
    ["fillColor","Couleur de fond","color"],["textColor","Couleur du texte","color"],
    ["clickable","Cliquable (survol + événement click)","checkbox"],["hoverColor","Couleur au survol","color"]],
  button:[["text","Libellé","text",null,"loc"],["name","Nom — « ok »/« cancel » = ENTRÉE/ÉCHAP natifs","text"],
    ["active","Focus à l'ouverture (active)","checkbox"]],
  iconbutton:[["imageData","Icône intégrée au script (PNG / JPG)","image"],["imagePath","… ou chemin d'un fichier (si aucune icône intégrée)","text"],["style","Style","select",["button","toolbutton"]],
    ["toggle","Mode bascule (toggle)","checkbox"],["name","Nom de variable (JS)","text"]],
  image:[["imageData","Image intégrée au script (PNG / JPG)","image"],["imagePath","… ou chemin d'un fichier (si aucune image intégrée)","text"]],
  checkbox:[["text","Libellé","text",null,"loc"],["name","Nom de variable (JS)","text"],["value","Cochée par défaut","checkbox"]],
  radiobutton:[["text","Libellé","text",null,"loc"],["name","Nom de variable (JS)","text"],["value","Sélectionné par défaut","checkbox"]],
  dropdownlist:[["items","Éléments (virgules — « - » = séparateur)","text"],["selection","Index sélectionné","number"],["name","Nom de variable (JS)","text"]],
  listbox:[["items","Éléments — lignes par virgules, colonnes par « | »","text"],["numberOfColumns","Nombre de colonnes","number"],
    ["showHeaders","Afficher les en-têtes","checkbox"],["columnTitles","Titres des colonnes (virgules)","text"],["columnWidths","Largeur des colonnes en px (virgules, vide = auto)","text"],
    ["multiselect","Sélection multiple","checkbox"],["name","Nom de variable (JS)","text"]],
  treeview:[["name","Nom de variable (JS)","text"]],
  treeitem:[["text","Texte","text",null,"loc"],["expanded","Déplié à l'ouverture (s'il contient des éléments)","checkbox"],["name","Nom de variable (JS) — facultatif","text"]],
  slider:[["value","Valeur","number"],["min","Min","number"],["max","Max","number"],["name","Nom de variable (JS)","text"]],
  scrollbar:[["value","Valeur","number"],["min","Min","number"],["max","Max","number"],
    ["stepdelta","Pas des boutons (stepdelta)","number"],["name","Nom de variable (JS)","text"]],
  progressbar:[["value","Valeur","number"],["max","Max","number"]],
  divider:[["alignment","Alignment","select",ALIGN_SELF],["width","Longueur fixe en px (0 = étirée)","number"]],
  dividerv:[["alignment","Alignment","select",ALIGN_SELF],["height","Longueur fixe en px (0 = étirée)","number"]]
};
var NO_COMMON={root:true,tab:true,divider:true,dividerv:true,treeitem:true};

/* Champ de saisie de l'inspecteur : met à jour la maquette sans reconstruire l'inspecteur
   (le focus et le curseur restent en place) ; une saisie continue = une étape d'annulation. */
function bindTyping(el,key,parse){
  el.oninput=function(){
    var n=findNode(S.tree,S.selId); if(!n) return;
    var v=parse(el.value);
    if(n.props[key]===v) return;
    beginEdit(key); n.props[key]=v;
    render(true);
  };
  el.onblur=function(){ EDIT.key=null; };
  return el;
}
function toNum(v){ var n=Number(v); return isFinite(n)?n:0; }

function buildField(node,def){
  var key=def[0],label=def[1],kind=def[2],options=def[3];
  if(kind==="heading") return h("div",{class:"field-head",text:label});
  var wrap=h("label",{class:"field"},h("span",{class:"field-lbl",text:label}));
  var el;
  if(kind==="text"){
    var multi = key==="text" && node.props.multiline && (node.type==="statictext"||node.type==="edittext");
    el = multi ? h("textarea",{rows:"3"}) : h("input",{type:"text"});
    el.value=node.props[key]==null?"":node.props[key];
    bindTyping(el,key,String);
  } else if(kind==="number"){
    el=h("input",{type:"number"}); el.value=node.props[key]==null?0:node.props[key];
    bindTyping(el,key,toNum);
  } else if(kind==="pair"){
    el=h("div",{class:"field-pair"});
    options.forEach(function(k,i){
      var inp=h("input",{type:"number",min:"0",title:k,"aria-label":label+" — "+(i?"hauteur":"largeur")});
      inp.value=node.props[k]||0;
      bindTyping(inp,k,toNum);
      el.appendChild(h("span",{class:"pair-lbl",text:i?"H":"L"}));
      el.appendChild(inp);
    });
    wrap=h("div",{class:"field"},h("span",{class:"field-lbl",text:label}));
  } else if(kind==="image"){
    // pas de <label> autour : un clic sur le libellé déclencherait le sélecteur de fichier caché
    wrap=h("div",{class:"field"},h("span",{class:"field-lbl",text:label}));
    var data=node.props[key];
    var fileIn=h("input",{type:"file",accept:"image/png,image/jpeg",style:{display:"none"}});
    fileIn.onchange=function(){
      var f=fileIn.files[0]; fileIn.value="";
      if(!f) return;
      if(!/^image\/(png|jpeg)$/.test(f.type)){ flash("Formats acceptés : PNG ou JPG."); return; }
      var rd=new FileReader();
      rd.onload=function(){
        var n=findNode(S.tree,S.selId); if(!n) return;
        pushHistory(); n.props[key]=rd.result; n.props.imageName=f.name;
        render();
      };
      rd.readAsDataURL(f);
    };
    el=h("div",{class:"img-field"},
      data ? h("img",{class:"img-thumb",src:data,alt:""}) : h("div",{class:"img-thumb empty",text:"aucune"}),
      h("div",{class:"img-meta"},
        h("div",{class:"img-name",text: data ? (node.props.imageName||"image")+" — "+Math.max(1,Math.round(imageBytes(data)/1024))+" Ko" : "Le script utilisera le chemin ci-dessous"}),
        h("div",{class:"img-btns"},
          h("button",{class:"act small",type:"button",text:data?"Remplacer…":"Choisir…",onclick:function(){ fileIn.click(); }}),
          data ? h("button",{class:"act small",type:"button",text:"Retirer",onclick:function(){
            var n=findNode(S.tree,S.selId); if(!n) return;
            pushHistory(); n.props[key]=""; n.props.imageName=""; render();
          }}) : null)),
      fileIn);
  } else if(kind==="color"){
    el=h("input",{type:"color",class:"clr"}); el.value=node.props[key]||"#000000";
    bindTyping(el,key,String);
  } else if(kind==="checkbox"){
    el=h("input",{type:"checkbox",class:"chk"}); el.checked=!!node.props[key];
    el.onchange=function(){ setProp(key,el.checked); };
  } else {
    el=h("select");
    options.forEach(function(o){ var v=Array.isArray(o)?o[0]:o, t=Array.isArray(o)?o[1]:(o===""?"(auto)":o); el.appendChild(h("option",{value:v,text:t})); });
    el.value=node.props[key]==null?"":node.props[key];
    el.onchange=function(){ setProp(key,el.value); };
  }
  wrap.appendChild(el);
  wrap.setAttribute("data-key",key);   // repère pour surligner le champ visé par un avertissement
  return wrap;
}

function renderMultiInspector(){
  var ids=S.multi.ids, box=h("div",{});
  box.appendChild(h("div",{class:"insp-head"},
    h("div",{},
      h("div",{class:"insp-type",text:ids.length+" éléments sélectionnés"}),
      h("div",{class:"insp-id",text:"Hiérarchie : Maj+clic = plage, Ctrl+clic = ajouter/retirer · Aperçu : Ctrl+clic = ajouter/retirer · Échap = annuler"}))));
  var names=computeNames(S.tree);
  var list=h("ul",{class:"multi-list"});
  treeOrder().filter(function(id){ return ids.indexOf(id)>=0; }).forEach(function(id){
    var n=findNode(S.tree,id);
    list.appendChild(h("li",{},h("span",{class:"tree-ic",text:CONTROL_DEFS[n.type].icon}),
      h("span",{text:n.type}), h("code",{text:names[id]})));
  });
  box.appendChild(list);
  var hasTab=topLevelSelection().some(function(id){ return findNode(S.tree,id).type==="tab"; });
  var acts=h("div",{class:"multi-actions"},
    h("button",{class:"act",text:"▣  Grouper dans un Group",title:"Ctrl+G",disabled:hasTab,onclick:function(){ wrapSelection("group"); }}),
    h("button",{class:"act",text:"◫  Grouper dans un Panel",disabled:hasTab,onclick:function(){ wrapSelection("panel"); }}),
    h("button",{class:"act",text:"⧉  Grouper dans un TabbedPanel",disabled:hasTab,onclick:function(){ wrapSelection("tabbedpanel"); }}),
    h("button",{class:"act danger",text:"🗑  Supprimer les "+ids.length+" éléments",onclick:removeSelection}));
  box.appendChild(acts);
  box.appendChild(h("div",{class:"insp-note"},
    h("div",{class:"insp-note-t",text:"Astuce"}),
    h("ul",{html: hasTab
      ? "<li>La sélection contient un <b>Tab</b> : il ne peut pas être groupé (il doit rester dans son TabbedPanel).</li>"
      : "<li>Cliquer <b>Group</b>, <b>Panel</b> ou <b>TabbedPanel</b> dans la palette range aussi la sélection dedans.</li>"+
        "<li>Le conteneur prend la place du premier élément et garde l'orientation de son parent.</li>"})));
  return box;
}
function renderInspector(){
  if(S.multi) return renderMultiInspector();
  var node=findNode(S.tree,S.selId)||S.tree;
  var box=h("div",{});
  var head=h("div",{class:"insp-head"},
    h("div",{},
      h("div",{class:"insp-type",text:node.type==="root"?"Window":CONTROL_DEFS[node.type].label}),
      h("div",{class:"insp-id",text:node.type==="root"?"racine de l'interface":"élément sélectionné"})));
  if(S.selId!=="root"){
    head.appendChild(h("div",{class:"insp-tools"},
      h("button",{text:"↑",title:"Monter",onclick:function(){moveSel(-1);}}),
      h("button",{text:"↓",title:"Descendre",onclick:function(){moveSel(1);}}),
      h("button",{text:"⧉",title:"Dupliquer",onclick:duplicateSel}),
      h("button",{class:"danger",text:"✕",title:"Supprimer (Suppr)",onclick:removeSel})));
  }
  if(S.selId!=="root"){
    head.querySelector(".insp-tools").insertBefore(
      h("button",{text:node.props.hidden?"◌":"👁",title:node.props.hidden?"Réafficher dans l'export":"Masquer (exclure de l'export)",
        onclick:function(){ toggleHidden(node.id); }}),
      head.querySelector(".insp-tools").firstChild);
  }
  box.appendChild(head);

  var ref=nodeRef(node.id);
  box.appendChild(h("div",{class:"insp-path"},
    h("code",{class:"insp-ref",text:ref,title:"Chemin complet : "+nodePath(node.id)}),
    h("button",{text:"Réf.",title:"Copier la référence à coller dans votre code",
      onclick:function(){ var r=nodeRef(node.id); copyText(r); flash("Référence copiée : "+r); }}),
    h("button",{text:"Chemin",title:"Copier le chemin complet (utile en mode resource string)",
      onclick:function(){ var pa=nodePath(node.id); copyText(pa); flash("Chemin copié : "+pa); }})));

  var fieldsBox=h("div",{class:"insp-fields"});
  if(node.props.hidden){
    fieldsBox.appendChild(h("div",{class:"field-lbl",style:{color:"#e8c88f"},
      text:"⚠ Cet item est masqué : il reste visible ici mais n'apparaît pas dans le code généré."}));
  }
  if(node.type==="root"&&node.props.localize){
    var lf=h("label",{class:"field"},h("span",{class:"field-lbl",text:"Titre (FR) — localize"}));
    var li=h("input",{type:"text"}); li.value=node.props.titleFr||"";
    bindTyping(li,"titleFr",String);
    lf.appendChild(li); fieldsBox.appendChild(lf);
  }
  var defs=(FIELDS[node.type]||[]).concat(FONT_TYPES[node.type]?FONT_FIELDS:[],NO_COMMON[node.type]?[]:COMMON_FIELDS);
  defs.forEach(function(d){
    fieldsBox.appendChild(buildField(node,d));
    if(d[4]==="loc"&&S.tree.props.localize){
      var w=h("label",{class:"field field-loc"},h("span",{class:"field-lbl",text:"↳ Version FR (localize)"}));
      var i2=h("input",{type:"text",placeholder:"vide = non localisé"}); i2.value=node.props.textFr||"";
      bindTyping(i2,"textFr",String);
      w.appendChild(i2); fieldsBox.appendChild(w);
    }
  });
  box.appendChild(fieldsBox);

  // avertissement cliqué : surligner les champs concernés (ou l'en-tête s'il n'y a pas de champ précis)
  if(S.hl && S.hl.id===node.id){
    var marked=0;
    S.hl.fields.forEach(function(k){
      var f=fieldsBox.querySelector('[data-key="'+k+'"]');
      if(f){ f.classList.add("field-hl","hl-"+S.hl.level); marked++; }
    });
    if(!marked){ head.classList.add("field-hl","hl-"+S.hl.level); }
  }

  box.appendChild(h("div",{class:"insp-note"},
    h("div",{class:"insp-note-t",text:"Rappels ScriptUI — "+targetOf(S.tree.props).label}),
    h("ul",{html:
      "<li><b>dialog</b> : ENTRÉE/ÉCHAP notifient les boutons nommés <code>ok</code>/<code>cancel</code>.</li>"+
      TARGET_NOTES[S.tree.props.targetApp||"generic"]+
      "<li><b>TabbedPanel</b> n'accepte que des <b>Tab</b>.</li>"+
      "<li><b>RadioButtons</b> : groupés par conteneur, un coché par défaut.</li>"+
      "<li><b>Custom</b> : largeur et hauteur obligatoires, dessin dans <code>onDraw</code>.</li>"+
      "<li><b>Persistance</b> : fichier de réglages dans le dossier utilisateur (toutes les applis).</li>"+
      "<li>Code ES3 : <code>var</code> uniquement, pas de fonctions fléchées.</li>"})));
  return box;
}

/* ---------- coloration syntaxique (vue Code) ---------- */
function escHtml(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
var HL_RE=/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b(var|function|return|if|else|new|this|true|false|null|undefined|instanceof|typeof)\b|\b(\d+(?:\.\d+)?)\b/g;
function highlight(code){
  var out="",last=0,m;
  HL_RE.lastIndex=0;
  while((m=HL_RE.exec(code))){
    var cls=m[1]?"c":m[2]?"s":m[3]?"k":"n", txt=m[0];
    // la ligne de maquette intégrée est longue : on l'abrège à l'écran (Copier / Télécharger la gardent entière)
    if(m[1] && txt.indexOf(MODEL_MARKER)===0 && txt.length>90) txt=txt.slice(0,90)+"… (maquette intégrée, "+m[0].length+" car.)";
    if(m[2] && txt.length>200) txt=txt.slice(0,80)+"…\" (données d'image, "+m[0].length+" car.)";
    out+=escHtml(code.slice(last,m.index))+'<span class="t-'+cls+'">'+escHtml(txt)+"</span>";
    last=HL_RE.lastIndex;
  }
  return out+escHtml(code.slice(last));
}
function codeView(code){
  var n=code.split("\n").length, nums=[];
  for(var i=1;i<=n;i++) nums.push(i);
  return h("div",{class:"codeview",onclick:function(e){e.stopPropagation();}},
    h("pre",{class:"code-gutter","aria-hidden":"true",text:nums.join("\n")}),
    h("pre",{class:"code-body",html:highlight(code)}));
}
function currentExport(){ return S.tab==="resource" ? generateResource(S.tree) : generateCode(S.tree); }

/* ---------- rendu global ----------
   render()      : reconstruit toute l'interface.
   render(true)  : reconstruit tout SAUF l'inspecteur, pour ne pas perdre la saisie en cours. */
function render(keepInspector){
  var app=document.getElementById("app");
  // couleurs de marque de l'application cible (logo « Sui » et bouton Télécharger)
  var tg=targetOf(S.tree.props);
  app.style.setProperty("--brand-bg",tg.brandBg); app.style.setProperty("--brand-fg",tg.brandFg);
  // couleur de surbrillance de toute l'interface = couleur de bordure de la cible
  app.style.setProperty("--accent",tg.brandFg);
  app.style.setProperty("--accent-soft",hexToRgba(tg.brandFg,.14));
  app.style.setProperty("--accent-faint",hexToRgba(tg.brandFg,.07));
  var oldRight = keepInspector ? app.querySelector(".cols > .right") : null;
  var oldTreeBox=app.querySelector(".tree"), oldCode=app.querySelector(".codeview");
  var treeScroll = oldTreeBox ? oldTreeBox.scrollTop : null;
  var codeScroll = oldCode ? [oldCode.scrollTop, oldCode.scrollLeft] : null;

  var issues=validate(S.tree);
  var errCount=issues.filter(function(i){return i.level==="err";}).length;
  var warnCount=issues.filter(function(i){return i.level==="warn";}).length;
  // surlignage d'un avertissement : disparaît quand la sélection change ou que le problème est réglé
  if(S.hl && (S.hl.id!==S.selId || !issues.some(function(i){ return i.id===S.hl.id && (i.fields||[]).join()===S.hl.fields.join(); })))
    S.hl=null;
  var parts=[];   // enfants de #app placés avant les colonnes

  /* topbar */
  var tplWrap=h("div",{class:"tpl-wrap"},
    h("button",{class:"act",text:"Templates ▾",onclick:function(e){ e.stopPropagation(); S.tplOpen=!S.tplOpen; S.snapOpen=false; render(); }}));
  if(S.tplOpen){
    var menu=h("div",{class:"tpl-menu"});
    TEMPLATES.forEach(function(t){
      menu.appendChild(h("button",{text:t.label,onclick:function(){ pushHistory(); S.tree=t.make(); S.selId="root"; S.tplOpen=false; S.collapsed={}; render(); }}));
    });
    tplWrap.appendChild(menu);
  }
  var fileInput=h("input",{type:"file",accept:".json,.jsx,.js,.txt,application/json",style:{display:"none"}});
  fileInput.onchange=function(){ if(fileInput.files[0]) importModelFile(fileInput.files[0]); fileInput.value=""; };

  var snapWrap=h("div",{class:"tpl-wrap"},
    h("button",{class:"act",text:"Snapshots"+(S.snapshots.length?" ("+S.snapshots.length+") ▾":" ▾"),
      onclick:function(e){ e.stopPropagation(); S.snapOpen=!S.snapOpen; S.tplOpen=false; render(); }}));
  if(S.snapOpen){
    var sm=h("div",{class:"tpl-menu snap-menu",onclick:function(e){ e.stopPropagation(); }});
    if(!S.snapshots.length) sm.appendChild(h("div",{class:"snap-empty",text:"Aucun snapshot. Prenez-en un avant une modification risquée."}));
    S.snapshots.forEach(function(sn){
      sm.appendChild(h("div",{class:"snap-row"},
        h("span",{class:"snap-name",text:sn.name,title:"Charger « "+sn.name+" »",onclick:function(){ snapshotLoad(sn.id); }}),
        h("span",{class:"snap-date",text:sn.date.split(" ").pop()}),
        h("button",{text:"Charger",onclick:function(){ snapshotLoad(sn.id); }}),
        h("button",{class:"danger",text:"✕",onclick:function(){ snapshotDelete(sn.id); }})));
    });
    var snapFile=h("input",{type:"file",accept:".json,application/json",style:{display:"none"}});
    snapFile.onchange=function(){
      if(snapFile.files[0]){
        var r=new FileReader();
        r.onload=function(){
          try{
            var list=validSnapshots(JSON.parse(r.result).snapshots);
            if(!list.length) throw new Error("vide");
            S.snapshots=list.concat(S.snapshots);
            flash(list.length+" snapshot(s) importé(s) ✓");
          }catch(err){ flash("Fichier de snapshots invalide."); }
        };
        r.readAsText(snapFile.files[0]);
      }
      snapFile.value="";
    };
    sm.appendChild(h("div",{class:"snap-actions"},
      h("button",{text:"＋ Nouveau",onclick:snapshotAdd}),
      h("button",{text:"Exporter tout",onclick:function(){
        if(!S.snapshots.length){ flash("Aucun snapshot à exporter."); return; }
        download(JSON.stringify({app:"scriptui-dialog-designer",version:APP_VERSION,snapshots:S.snapshots},null,2),baseName()+".snapshots.json");
      }}),
      h("button",{text:"Importer",onclick:function(){ snapFile.click(); }}),
      snapFile));
    snapWrap.appendChild(sm);
  }

  // application cible : change le code généré (#target, annulation, fenêtres…) — aussi réglable dans la fenêtre racine
  var targetSel=h("select",{class:"target-sel",title:"Application cible du script"});
  TARGET_OPTIONS.forEach(function(o){ targetSel.appendChild(h("option",{value:o[0],text:o[1]})); });
  targetSel.value=S.tree.props.targetApp||"generic";
  targetSel.onchange=function(){
    if(S.tree.props.targetApp===targetSel.value) return;
    pushHistory(); S.tree.props.targetApp=targetSel.value; render();
  };
  var targetPick=h("label",{class:"target-pick"},h("span",{text:"Cible"}),targetSel);
  var actions=h("div",{class:"topbar-actions"},
    targetPick, tplWrap, snapWrap,
    h("div",{class:"seg"},
      h("button",{text:"↶",title:"Annuler (Ctrl+Z)",disabled:!S.past.length,onclick:undo}),
      h("button",{text:"↷",title:"Rétablir (Ctrl+Y)",disabled:!S.future.length,onclick:redo})),
    h("div",{class:"seg"},
      h("button",{class:S.tab==="preview"?"on":"",text:"Aperçu",onclick:function(){S.tab="preview";render();}}),
      h("button",{class:S.tab==="code"?"on":"",text:"Code .jsx",onclick:function(){S.tab="code";render();}}),
      h("button",{class:S.tab==="resource"?"on":"",text:"Resource",onclick:function(){S.tab="resource";render();}})),
    h("button",{class:"act",text:"JSON ⇩",title:"Sauvegarder la maquette (avec les snapshots)",
      onclick:function(){ download(JSON.stringify({app:"scriptui-dialog-designer",version:APP_VERSION,tree:S.tree,snapshots:S.snapshots},null,2),baseName()+".maquette.json"); }}),
    h("button",{class:"act",text:"Ouvrir ⇧",title:"Rouvrir une maquette : .json, ou .jsx exporté avec la maquette intégrée",onclick:function(){ fileInput.click(); }}),
    fileInput,
    h("button",{class:"act",text:"Copier",title:"Copier le code de l'onglet affiché (Resource ou .jsx)",
      onclick:function(e){ copyText(currentExport(),e.target); }}),
    h("button",{class:"act primary",text:"Télécharger .jsx",onclick:function(){ download(currentExport(),baseName()+".jsx"); }}),
    h("button",{class:"act",text:"?",title:"Aide",onclick:function(){ S.helpOpen=true; render(); }})
  );
  parts.push(h("header",{class:"topbar"},
    h("div",{class:"brand"},
      h("span",{class:"brand-glyph",text:"Sui"}),
      h("div",{},
        h("div",{class:"brand-name"},"ScriptUI Dialog Designer ",h("span",{class:"brand-v",text:"v"+APP_VERSION})),
        h("div",{class:"brand-sub",text:"Interfaces ScriptUI pour Photoshop, Illustrator, InDesign, After Effects et Bridge — 100 % hors ligne"}))),
    actions));

  if(S.notice) parts.push(h("div",{class:"notice",role:"status",text:S.notice}));

  if(issues.length){
    var lintItems=h("div",{class:"lint-items"});
    var LBL={err:"Erreur",warn:"Avertissement",info:"Info"};
    issues.forEach(function(it){
      lintItems.appendChild(h("button",{class:"lint-it "+it.level,
        text:LBL[it.level]+" — "+it.msg,
        onclick:function(){ S.selId=it.id; S.tab="preview"; S.hl={id:it.id,fields:it.fields||[],level:it.level,fresh:true}; render(); }}));
    });
    parts.push(h("div",{class:"lint"},
      h("span",{class:"lint-badge"+(errCount?" err":warnCount?"":" info"),text:(errCount?"⛔ ":warnCount?"⚠ ":"ℹ ")+issues.length}),
      lintItems));
  }

  /* colonnes */
  var left=h("aside",{class:"left"});
  left.appendChild(h("div",{class:"side-title"},h("span",{text:"Contrôles natifs"}),h("span",{class:"side-hint",text:"cliquer ou glisser"})));
  var pal=h("div",{class:"palette"});
  Object.keys(CONTROL_DEFS).forEach(function(type){
    var d=CONTROL_DEFS[type];
    var b=h("button",{class:"pal-btn",title:"Cliquer pour ajouter, ou glisser vers l'aperçu",onclick:function(){ addControl(type); }},
      h("span",{class:"pal-ic",text:d.icon}), d.label);
    b.draggable=true;
    b.addEventListener("dragstart",function(e){
      DND.newType=type; DND.dragId=null;
      try{ e.dataTransfer.setData("text/plain","new:"+type); e.dataTransfer.effectAllowed="copy"; }catch(err){}
      b.classList.add("pal-dragging");
    });
    b.addEventListener("dragend",function(){ b.classList.remove("pal-dragging"); endDrag(); });
    pal.appendChild(b);
  });
  left.appendChild(pal);
  left.appendChild(h("div",{class:"side-title"},
    h("span",{text:"Hiérarchie"}), h("span",{class:"side-hint",text:"glisser-déposer · ↑↓ pour naviguer"})));
  var treeBox=h("div",{class:"tree",role:"tree","aria-label":"Hiérarchie des contrôles",ondragover:function(e){e.preventDefault();}});
  // nouvelle sélection : on déplie ses groupes parents pour qu'elle soit visible dans la hiérarchie
  // (seulement quand la sélection change : l'utilisateur peut ensuite replier ce groupe librement)
  // (sauf clic dans l'aperçu : on se contente de mettre en évidence le groupe replié qui la contient)
  var selChanged = S.selId!==S.lastRevealed;
  // sélection multiple : annulée si l'élément principal a changé par un autre moyen, nettoyée des éléments supprimés
  if(S.multi){
    if(S.multi.primary!==S.selId) S.multi=null;
    else {
      S.multi.ids=S.multi.ids.filter(function(id){ return findNode(S.tree,id); });
      if(S.multi.ids.length<2) S.multi=null;
    }
  }
  if(selChanged){ if(!S.noExpand) expandAncestors(S.selId); S.lastRevealed=S.selId; }
  S.noExpand=false;
  var selProxy=hiddenSelAncestor();
  S.proxyId=selProxy?selProxy.id:null;
  renderTreeRows(S.tree,0,treeBox);
  left.appendChild(treeBox);

  var dupBox=h("button",{class:"dz-box",title:"Glissez un contrôle ici pour le dupliquer (ou cliquez pour dupliquer la sélection)",
    onclick:function(){ duplicateSel(); }},
    h("span",{class:"dz-ic",text:"⧉"}), h("span",{text:"Dupliquer"}));
  var delBox=h("button",{class:"dz-box",title:"Glissez un contrôle ici pour le supprimer (ou cliquez pour supprimer la sélection)",
    onclick:function(){ removeSel(); }},
    h("span",{class:"dz-ic",text:"🗑"}), h("span",{text:"Supprimer"}));
  attachActionZone(dupBox,"duplicate","over-dup");
  attachActionZone(delBox,"delete","over-del");
  left.appendChild(h("div",{class:"tree-actions"},dupBox,delBox));

  var center=h("main",{class:"center"+(S.tab==="preview"?" canvasmode":"")+(S.spaceDown?" spacemode":""),
    onclick:function(){ if(S.mode==="edit"&&S.selId!=="root"){ S.selId="root"; render(); } }});
  if(S.tab==="preview"){
    var vt=viewTree(), rp=vt.props, test=S.mode==="test";
    var stage=h("div",{class:"canvas"});
    var toolbar=h("div",{class:"pv-toolbar"},
      h("div",{class:"mode-seg"},
        h("button",{class:!test?"on":"",text:"✎ Édition",onclick:function(e){e.stopPropagation();S.mode="edit";S.testBase=null;render();}}),
        h("button",{class:test?"on":"",text:"▶ Test",onclick:function(e){e.stopPropagation();S.mode="test";S.testBase=null;render();}})),
      test ? h("button",{class:"act small",text:"↺ Réinitialiser",title:"Revenir aux valeurs par défaut de la maquette",
        onclick:function(e){ e.stopPropagation(); resetTest(); }}) : null,
      h("div",{class:"zoom-hud"},
        h("button",{text:"−",title:"Dézoomer",onclick:function(e){e.stopPropagation();setZoom(S.zoom/1.15);}}),
        h("div",{class:"zoom-val",text:Math.round(S.zoom*100)+" %",title:"Recadrer (100 %)",
          onclick:function(e){e.stopPropagation();resetView();}}),
        h("button",{text:"+",title:"Zoomer",onclick:function(e){e.stopPropagation();setZoom(S.zoom*1.15);}}),
        h("button",{text:"⛶",title:"Recadrer",onclick:function(e){e.stopPropagation();resetView();}})),
      h("div",{class:"pan-hint",text:"Molette enfoncée (ou Espace + clic) pour déplacer · molette pour zoomer"}));
    var win=h("div",{class:"ae-window"+(!test&&S.selId==="root"?" sel":""),
      onclick:function(e){ e.stopPropagation(); if(!test&&S.selId!=="root"&&!e.ctrlKey&&!e.metaKey){ S.selId="root"; render(); } }},
      rp.borderless&&rp.winType!=="dockable" ? null : h("div",{class:"ae-titlebar"},
        h("span",{class:"ae-title",text:rp.title+(rp.winType==="dockable"?"  (panneau dockable)":"")}),
        h("span",{class:"ae-winbtns"},
          rp.minimizeButton&&rp.winType!=="dialog" ? h("span",{text:"–",title:"minimizeButton"}) : null,
          rp.maximizeButton&&rp.winType!=="dialog" ? h("span",{text:"□",title:"maximizeButton"}) : null,
          rp.closeButton!==false||rp.winType==="dockable" ? h("span",{text:"×",title:"closeButton"}) : null)));
    var body=h("div",{class:"ae-body",style:containerStyle(vt)});
    if(!test) body.style.userSelect="none";   // pas de sélection de texte parasite au clic
    vt.children.forEach(function(c){ var el=renderPreviewNode(c,rp.orientation); if(el) body.appendChild(el); });
    if(!vt.children.length) body.appendChild(h("span",{class:"pv-empty",text:"Ajoutez des contrôles depuis la palette ou chargez un template"}));
    if(!test){
      attachDropZone(body,S.tree,true);
      // barre de titre / bordures : traiter comme l'intérieur de la fenêtre, pas comme le vide
      win.addEventListener("dragover",function(e){ if(dndBusy()) zoneOver(e,body,S.tree,true); });
      win.addEventListener("drop",function(e){
        if(!dndBusy()) return;
        e.preventDefault(); e.stopPropagation(); finishDrop();
      });
    }
    win.appendChild(body);
    stage.appendChild(win);
    var stageNote=h("div",{class:"stage-note",text: test
      ? "Mode Test : interagissez comme dans l'application (saisie, cases, listes, sliders, onglets). Les clics boutons sont simulés. La maquette n'est pas modifiée."
      : "Mode Édition : cliquez un contrôle pour l'éditer, glissez-le pour le déplacer. La barre verte s'aimante à l'interstice le plus proche du curseur ; le cadre pointillé montre le conteneur qui recevra le contrôle."});
    center.appendChild(toolbar);
    center.appendChild(stage);
    center.appendChild(stageNote);
    center.appendChild(h("div",{class:"trash-badge"},
      h("span",{class:"tb-wait",text:"🗑  Maintenez pour supprimer…"}),
      h("span",{class:"tb-go",text:"🗑  Relâchez pour supprimer"})));
    // le vide autour de la fenêtre = corbeille (les zones internes stoppent la propagation)
    stage.addEventListener("dragover",function(e){
      if(!DND.dragId) return;
      e.preventDefault();
      markAction(center,"delete","trashzone");
    });
    stage.addEventListener("drop",function(e){
      if(!dndBusy()) return;
      e.preventDefault();
      finishDrop();
    });
    stage.style.transform="translate("+S.pan.x+"px,"+S.pan.y+"px) scale("+S.zoom+")";
    attachCanvasNav(center,stage);
  } else {
    CANVAS_EL=null;
    center.appendChild(codeView(currentExport()));   // seul l'onglet affiché est généré
  }

  var cols;
  if(oldRight){
    // rendu partiel : on garde l'inspecteur (et son focus), on remplace le reste
    cols=oldRight.parentNode;
    Array.prototype.slice.call(app.childNodes).forEach(function(c){ if(c!==cols) app.removeChild(c); });
    cols.replaceChild(left,cols.children[0]);
    cols.replaceChild(center,cols.children[1]);
    parts.forEach(function(p){ app.insertBefore(p,cols); });
    var refEl=oldRight.querySelector(".insp-ref");
    if(refEl){ refEl.textContent=nodeRef(S.selId)||""; refEl.title="Chemin complet : "+nodePath(S.selId); }
  } else {
    app.innerHTML="";
    var right=h("aside",{class:"right",onclick:function(e){e.stopPropagation();}});
    right.appendChild(renderInspector());
    cols=h("div",{class:"cols"},left,center,right);
    parts.forEach(function(p){ app.appendChild(p); });
    app.appendChild(cols);
  }
  if(treeScroll!==null) treeBox.scrollTop=treeScroll;
  if(selChanged) scrollRowIntoView(treeBox,selProxy?selProxy.id:S.selId);
  if(!S.hl){
    Array.prototype.forEach.call(app.querySelectorAll(".field-hl"),function(el){ el.classList.remove("field-hl","hl-err","hl-warn","hl-info"); });
  } else if(S.hl.fresh){
    // premier affichage après le clic : amener le champ en vue et lui donner le focus
    S.hl.fresh=false;
    var hls=app.querySelectorAll(".right .field-hl"), hlEl=hls[0];
    if(hlEl){
      // cadrer tous les champs surlignés : le dernier puis le premier (prioritaire s'ils ne tiennent pas ensemble).
      // scrollIntoView trouve le bon conteneur : l'inspecteur, ou la page en affichage étroit (colonnes empilées).
      hls[hls.length-1].scrollIntoView({block:"nearest"});
      hlEl.scrollIntoView({block:"nearest"});
      var ctl=hlEl.querySelector("input,select,textarea");
      if(ctl){ try{ ctl.focus({preventScroll:true}); }catch(e){ ctl.focus(); } }
    }
  }
  var newCode=app.querySelector(".codeview");
  if(newCode&&codeScroll){ newCode.scrollTop=codeScroll[0]; newCode.scrollLeft=codeScroll[1]; }

  if(S.ctx){ var cm=renderCtxMenu(); if(cm) app.appendChild(cm); }
  if(S.helpOpen) app.appendChild(renderHelp());
  saveLater();
}

function renderHelp(){
  var bg=h("div",{class:"modal-bg",onclick:function(e){ if(e.target===bg){ S.helpOpen=false; render(); } }});
  bg.appendChild(h("div",{class:"modal"},
    h("button",{class:"modal-close",text:"Fermer",onclick:function(){ S.helpOpen=false; render(); }}),
    h("h2",{text:"Prise en main"}),
    h("p",{class:"credit",html:'Inspiré de <a href="https://scriptui.joonas.me/" target="_blank" rel="noopener">ScriptUI Dialog Builder</a> de Joonas Pääkkö.'}),
    h("p",{text:"Dessinez votre interface, l'outil génère le code ExtendScript prêt à l'emploi dans Photoshop, Illustrator, InDesign, After Effects ou Bridge."}),
    h("h3",{text:"En 5 étapes"}),
    h("ul",{html:
      "<li><b>Templates ▾</b> — partez d'un modèle ou d'une fenêtre vide.</li>"+
      "<li>Choisissez l'<b>application cible</b> (barre du haut) : le code s'adapte (<code>#target</code>, annulation, types de fenêtre).</li>"+
      "<li>Sélectionnez la <b>fenêtre racine</b> et réglez son type : <code>dialog</code>, <code>palette</code>, <code>window</code> ou <code>dockable</code> (After Effects).</li>"+
      "<li>Ajoutez des contrôles : <b>glissez-les</b> depuis la palette à l'endroit voulu dans l'aperçu, ou cliquez-les pour les ajouter au conteneur sélectionné.</li>"+
      "<li><b>Nommez</b> les contrôles utiles — ce nom devient la variable dans le code et dans <code>getSettings()</code>.</li>"+
      "<li><b>Télécharger .jsx</b>, puis lancez-le depuis l'application (voir « Lancer le script » plus bas).</li>"}),
    h("h3",{text:"Mise en page"}),
    h("ul",{html:
      "<li>ScriptUI ne positionne pas au pixel : tout passe par <code>orientation</code>, <code>alignChildren</code>, <code>spacing</code>, <code>margins</code>.</li>"+
      "<li>Une ligne « libellé + champ » = un <b>Group</b> en <code>row</code>, avec le champ en <code>alignment: fill</code>.</li>"+
      "<li>Réorganisez par <b>glisser-déposer</b> dans la hiérarchie.</li>"}),
    h("h3",{text:"Syntaxes utiles"}),
    h("ul",{html:
      "<li><b>DropdownList</b> : items séparés par des virgules ; un item <code>-</code> = séparateur.</li>"+
      "<li><b>ListBox multi-colonnes</b> : lignes par virgules, colonnes par <code>|</code> — <code>John | Doe, Jane | Doe</code>.</li>"+
      "<li><b>TreeView</b> : ses éléments sont des <b>TreeItem</b> dans la hiérarchie (palette → TreeItem, TreeView sélectionné). Un TreeItem qui contient d'autres TreeItem devient un nœud dépliable. Glissez-les pour réorganiser l'arbre.</li>"+
      "<li><b>Custom (onDraw)</b> : élément dessiné à la main (fond, texte centré, couleur au survol). Le code <code>onDraw</code> généré est un point de départ à personnaliser ; le clic arrive par <code>addEventListener(\"click\")</code>.</li>"+
      "<li><b>StaticText multiligne</b> : le multiligne natif de ScriptUI est parfois capricieux ; l'option « une ligne = un StaticText » exporte chaque ligne séparément dans un groupe.</li>"+
      "<li><b>VerticalTabs</b> : onglets verticaux. ScriptUI n'en a pas en natif : le code crée une liste à gauche et des pages superposées (<code>stack</code>) qui s'affichent selon la ligne choisie. Il accepte des <b>Tab</b>, comme le TabbedPanel.</li>"+
      "<li><b>Image / IconButton</b> : « Choisir… » intègre un PNG ou JPG directement dans le .jsx (aucun fichier à livrer avec le script). Une image utilisée plusieurs fois n'est écrite qu'une fois. Gardez des images légères.</li>"+
      "<li><b>Panel</b> : <code>borderStyle</code> change la bordure (<code>topDivider</code> = simple trait en haut, pratique pour des sections).</li>"+
      "<li><b>StaticText</b> : <code>truncate</code> abrège un texte trop long (« …  » au milieu ou à la fin) — nécessite une largeur fixe.</li>"}),
    h("h3",{text:"Types de fenêtre"}),
    h("ul",{html:
      "<li><code>dialog</code> : modale, attend OK / Annuler. <code>palette</code> : flottante, reste ouverte pendant qu'on travaille.</li>"+
      "<li><code>window</code> : fenêtre simple non modale, proche de <code>palette</code>.</li>"+
      "<li><code>dockable</code> : panneau ancrable, <b>After Effects uniquement</b> (dossier <i>ScriptUI Panels</i>).</li>"+
      "<li>Photoshop ferme les palettes à la fin du script : utilisez <code>dialog</code> (sauf barre de progression pendant un traitement).</li>"+
      "<li>Illustrator, InDesign, Bridge : les palettes restent ouvertes grâce à <code>#targetengine</code>, ajouté automatiquement.</li>"+
      "<li>Options de la fenêtre racine : bouton fermer / réduire / agrandir, <code>borderless</code> (sans barre de titre — prévoyez un bouton pour fermer).</li>"}),
    h("h3",{text:"Lancer le script"}),
    h("ul",{html:
      "<li><b>Photoshop / Illustrator</b> : <i>Fichier &gt; Scripts &gt; Parcourir…</i> ; pour l'avoir dans le menu, copiez le .jsx dans le dossier <code>Presets\\Scripts</code> de l'appli puis redémarrez.</li>"+
      "<li><b>InDesign</b> : panneau <i>Fenêtre &gt; Utilitaires &gt; Scripts</i>, clic droit sur « Utilisateur » &gt; <i>Faire apparaître dans l'Explorateur</i>, déposez-y le .jsx.</li>"+
      "<li><b>After Effects</b> : <i>Fichier &gt; Scripts &gt; Exécuter un fichier de script…</i> ; panneau ancrable : dossier <code>Scripts\\ScriptUI Panels</code>, puis menu <b>Fenêtre</b>. Cochez <i>Préférences &gt; Scripts et expressions &gt; Autoriser l'écriture de scripts…</i> si le script écrit des fichiers.</li>"+
      "<li><b>Bridge</b> : <i>Préférences &gt; Scripts de démarrage &gt; Afficher mes scripts de démarrage</i>, déposez-y le .jsx puis redémarrez.</li>"+
      "<li>Tous : vous pouvez aussi l'ouvrir et l'exécuter depuis <b>VS Code</b> avec l'extension <i>ExtendScript Debugger</i>.</li>"+
      "<li>Chemins : utilisez <code>/</code> et non <code>\\</code> dans le code (<code>File(\"C:/Ressources/icone.png\")</code>).</li>"}),
    h("h3",{text:"Productivité"}),
    h("ul",{html:
      "<li><b>Clic droit</b> sur un contrôle (aperçu ou hiérarchie) : copier / couper / coller, copier la référence, dupliquer, masquer, replier, supprimer.</li>"+
      "<li><b>Sélection multiple</b> — hiérarchie : <b>Maj+clic</b> = plage, <b>Ctrl+clic</b> = ajouter / retirer ; aperçu : <b>Ctrl+clic</b> = ajouter / retirer. Cliquer ensuite <b>Group</b>, <b>Panel</b> ou <b>TabbedPanel</b> dans la palette (ou Ctrl+G) range les éléments dedans. Suppr les supprime tous.</li>"+
      "<li><b>Ctrl+C / Ctrl+V</b> : copiez un contrôle puis collez-le dans le conteneur sélectionné (ou juste après le contrôle sélectionné), même dans un autre panneau.</li>"+
      "<li><b>Alt + Glisser</b> duplique au lieu de déplacer.</li>"+
      "<li><b>Mode Test</b> : jouez avec l'interface sans rien modifier — la maquette et le code restent intacts. ↺ remet les valeurs par défaut.</li>"+
      "<li>Deux cases en bas de la hiérarchie : glissez-y un contrôle pour le <b>dupliquer</b> ou le <b>supprimer</b> (un clic agit sur la sélection).</li>"+
      "<li>Glisser un contrôle dans le <b>vide autour de la fenêtre</b> le supprime, avec une <b>sécurité</b> : maintenez-le 0,5 s dans le vide ; quand le cadre <b>clignote</b>, relâchez pour supprimer. Relâché plus tôt, rien n'est supprimé. La case <b>Supprimer</b> de la hiérarchie supprime immédiatement. Ctrl+Z annule.</li>"+
      "<li><b>Masquer</b> conserve l'item dans la maquette mais l'exclut du code généré — ou l'exporte en commentaire si l'option est cochée (fenêtre racine, section Export).</li>"+
      "<li><b>Copier la référence</b> donne le nom de variable à coller dans votre code métier (ex. <code>layerName.text</code>).</li>"+
      "<li><b>Snapshots</b> : figez un état avant une modification risquée, rechargez-le en un clic. Ils voyagent dans l'export JSON.</li>"+
      "<li><b>Double-clic</b> sur un conteneur dans la hiérarchie : replier / déplier.</li>"+
      "<li><b>Clic</b> dans l'aperçu sur un élément d'un groupe replié : le groupe est mis en évidence (bordure pointillée) sans être déplié. <b>Double-clic</b> dans l'aperçu : déplie et montre l'élément.</li>"}),
    h("h3",{text:"Naviguer dans l'aperçu"}),
    h("ul",{html:
      "<li><b>Molette enfoncée + déplacer</b> — déplacer la fenêtre dans le canevas.</li>"+
      "<li><b>Espace + clic gauche</b> — même chose, pour les portables sans bouton central.</li>"+
      "<li><b>Molette</b> — zoomer autour du curseur (la molette ne fait jamais défiler la fenêtre).</li>"+
      "<li><b>Ctrl+0</b> ou le bouton ⛶ — recadrer à 100 %.</li>"}),
    h("h3",{text:"Raccourcis"}),
    h("ul",{html:
      "<li>Ctrl+Z / Ctrl+Y — annuler / rétablir (une saisie continue dans un champ = une seule étape)</li>"+
      "<li>Ctrl+C / Ctrl+X / Ctrl+V — copier / couper / coller un contrôle</li>"+
      "<li>Ctrl+D — dupliquer le contrôle sélectionné</li>"+
      "<li>Maj+clic / Ctrl+clic (hiérarchie) — sélection multiple ; Ctrl+G — la grouper dans un Group ; Échap — l'annuler</li>"+
      "<li>Suppr ou Retour arrière — supprimer le contrôle sélectionné</li>"+
      "<li>↑ / ↓ — sélection précédente / suivante dans la hiérarchie</li>"+
      "<li>← / → — replier / déplier le conteneur sélectionné</li>"+
      "<li>Alt+↑ / Alt+↓ — monter / descendre le contrôle dans son conteneur</li>"+
      "<li>Alt+E — copier le code dans le presse-papiers</li>"+
      "<li>Ctrl+0 — recadrer l'aperçu</li><li>Échap — fermer les menus</li>"}),
    h("h3",{text:"Sauvegarde"}),
    h("ul",{html:
      "<li><b>Réglages d'export</b> (fenêtre racine, section Export) : afficher ou non la fenêtre à la fin, enveloppe de fonction, indentation 2 ou 4 espaces, liste des références des contrôles nommés.</li>"+
      "<li><b>Automatique</b> : la maquette et les snapshots sont gardés dans ce navigateur et restaurés au prochain lancement.</li>"+
      "<li><b>JSON ⇩</b> exporte la maquette (à archiver / partager), <b>Ouvrir ⇧</b> la réimporte.</li>"+
      "<li>Le <b>.jsx exporté</b> contient aussi la maquette sur sa dernière ligne (<code>// @scriptui-dialog-designer …</code>) : <b>Ouvrir ⇧</b> accepte directement le .jsx. Option « Intégrer la maquette » dans la fenêtre racine.</li>"})
  ));
  return bg;
}

/* ---------- raccourcis clavier ---------- */
document.addEventListener("keyup",function(e){
  if(e.code==="Space"&&S.spaceDown){ S.spaceDown=false; var c=document.querySelector(".center"); if(c) c.classList.remove("spacemode"); }
});
document.addEventListener("keydown",function(e){
  var tag=(document.activeElement||{}).tagName;
  var inField = tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT";
  var k=(e.key||"").toLowerCase(), mod=e.ctrlKey||e.metaKey;
  if(e.key==="Escape"){
    if(S.ctx||S.tplOpen||S.snapOpen){ S.ctx=null; S.tplOpen=false; S.snapOpen=false; render(); }
    else if(S.helpOpen){ S.helpOpen=false; render(); }
    else if(S.multi){ S.multi=null; render(); }
    return;
  }
  if(S.helpOpen) return;
  // Espace = main de déplacement, sauf sur un bouton focalisé (activation clavier normale)
  if(e.code==="Space"&&!inField&&tag!=="BUTTON"&&S.tab==="preview"){
    if(!S.spaceDown){ S.spaceDown=true; var c2=document.querySelector(".center"); if(c2) c2.classList.add("spacemode"); }
    e.preventDefault(); return;
  }
  if(mod&&k==="0"){ e.preventDefault(); resetView(); return; }
  if(mod&&!e.shiftKey&&k==="z"){ e.preventDefault(); undo(); return; }
  if(mod&&(k==="y"||(e.shiftKey&&k==="z"))){ e.preventDefault(); redo(); return; }
  if(e.altKey&&k==="e"){ e.preventDefault(); copyText(generateCode(S.tree)); flash("Code exporté vers le presse-papiers ✓"); return; }
  if(inField) return;
  // raccourcis de structure : ignorés si du texte est sélectionné (copie native de la vue Code)
  var textSel = window.getSelection && !window.getSelection().isCollapsed;
  if(mod&&k==="c"&&!textSel){ e.preventDefault(); copySel(); }
  else if(mod&&k==="x"&&!textSel){ e.preventDefault(); cutSel(); }
  else if(mod&&k==="v"){ e.preventDefault(); pasteClip(); }
  else if(mod&&k==="d"){ e.preventDefault(); duplicateSel(); }
  else if(e.key==="Delete"||e.key==="Backspace"){ e.preventDefault(); removeSel(); }
  else if(mod&&k==="g"){ e.preventDefault(); if(S.multi) wrapSelection("group"); else flash("Maj+clic ou Ctrl+clic dans la hiérarchie pour sélectionner plusieurs éléments, puis Ctrl+G."); }
  else if(e.altKey&&(e.key==="ArrowUp"||e.key==="ArrowDown")){ e.preventDefault(); moveSel(e.key==="ArrowUp"?-1:1); }
  else if(!mod&&!e.altKey&&(e.key==="ArrowUp"||e.key==="ArrowDown")){ e.preventDefault(); selectStep(e.key==="ArrowUp"?-1:1); }
  else if(!mod&&!e.altKey&&(e.key==="ArrowLeft"||e.key==="ArrowRight")){
    var sn=findNode(S.tree,S.selId);
    if(sn&&sn.children&&sn.children.length&&(!!S.collapsed[sn.id])!==(e.key==="ArrowLeft")){ e.preventDefault(); toggleCollapse(sn.id); }
  }
});
document.addEventListener("click",function(){
  if(S.tplOpen||S.snapOpen||S.ctx){ S.tplOpen=false; S.snapOpen=false; S.ctx=null; render(); }
});
document.addEventListener("contextmenu",function(e){
  if(S.ctx && !e.target.closest(".ctx-menu") && !e.target.closest(".tree-row") && !e.target.closest(".ae-body")){
    S.ctx=null; render();
  }
});
document.addEventListener("dragend",endDrag);
document.addEventListener("drop",function(e){ e.preventDefault(); endDrag(); });

if(restoreSaved()) note("Session précédente restaurée ✓ — Templates ▾ pour repartir de zéro");
render();
