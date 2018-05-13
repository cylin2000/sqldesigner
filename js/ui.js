/*UI的JavaScript扩展*/

SQL.UI = {
    "showTableProperties":function(){
        var tables = SQL.Designer.tableManager.selection;
        if(tables.length == 1){
            var table = tables[0];

            var name = table.data.title;
            SQL.UI.setTableProperty('Name',name);

        }
    },
	"showColumnProperties":function(){
		var row = SQL.Designer.rowManager.selected;
		if(row){

		}
    },
    "setTableProperty" : function(name,value){
        var rows = $('#pg-table').propertygrid('getRows');
        $.each(rows,function(i,e){
            if(e.name == name){
                //set value
                $('#pg-table').propertygrid('updateRow',{
                    index: i,
                    row: {
                        name: e.name,
                        value: value
                    }
                });
                return
            }
        })
    },
    "getTableProperty" : function(name){
        var rows = $('#pg-table').propertygrid('getRows');
        for(var i in rows){
            if(rows[i].name == name){
                return rows[i].value
            }
        }
    }
}


SQL.subscribe("tableselect", function(e){
    console.log('table select');
    console.log(e);

	var table = e.target;
	$("#table-tablename").val(table.data.title);
	$("#table-displayname").val(table.data.displayname);

	if(table){
		table.setTitle(table.getTitle());
	}
	SQL.UI.showTableProperties();
});

SQL.subscribe("tabledeselect", function(e){
    console.log('table deselect');
    console.log(e);

	var table = e.target;
	table.data.title = $("#table-tablename").val();
	table.data.displayname=$("#table-displayname").val();

	if(table){
		table.setTitle(table.getTitle());
	}
	//SQL.UI.showProperties();
});

SQL.subscribe("rowselect", function(e){
    console.log('row select');
    console.log(e);

	var row = e.target;
	$("#field-displayname").val(row.data.displayname);
	if(row){
		row.setTitle(row.getTitle());
		row.redraw();
	}

	//SQL.UI.showProperties();
});

SQL.subscribe("rowdeselect", function(e){
    console.log('row deselect');
    console.log(e);

	var row = e.target;
	row.data.displayname = $("#field-displayname").val();

	if(e.target == SQL.Designer.rowManager.selected){
		SQL.Designer.rowManager.selected = false;
	}
	if(row){
		row.setTitle(row.getTitle());
		row.redraw();
	}

	//SQL.UI.showProperties();
});

//overwrite redraw
SQL.Visual.prototype.setTitle = function(text) {
	if (!text) { return; }
	this.data.title = text;
	if(this.data.displayname != "" && this.data.displayname != text && this.data.displayname!= undefined){
		text += "【"+this.data.displayname+"】";
	}
	this.dom.title.innerHTML = text;
}


//overwrite TOXML/FROMXML
SQL.Table.prototype.toXML = function() {
	var t = this.getTitle().replace(/"/g,"&quot;");
	var xml = "";
	xml += '<table x="'+this.x+'" y="'+this.y+'" name="'+t+'">\n';
	for (var i=0;i<this.rows.length;i++) {
		xml += this.rows[i].toXML();
	}
	for (var i=0;i<this.keys.length;i++) {
		xml += this.keys[i].toXML();
	}
	var c = this.getComment();
	if (c) { 
		xml += "<comment>"+SQL.escape(c)+"</comment>\n"; 
	}
	//添加其他属性
	if(this.data.displayname){
		xml += "<displayname>"+this.data.displayname+"</displayname>\n";
	}

	xml += "</table>\n";
	return xml;
}

SQL.Table.prototype.fromXML = function(node) {
	var name = node.getAttribute("name");
	this.setTitle(name);
	var x = parseInt(node.getAttribute("x")) || 0;
	var y = parseInt(node.getAttribute("y")) || 0;
	this.moveTo(x, y);
	var rows = node.getElementsByTagName("row");
	for (var i=0;i<rows.length;i++) {
		var row = rows[i];
		var r = this.addRow("");
		r.fromXML(row);
	}
	var keys = node.getElementsByTagName("key");
	for (var i=0;i<keys.length;i++) {
		var key = keys[i];
		var k = this.addKey();
		k.fromXML(key);
	}
	for (var i=0;i<node.childNodes.length;i++) {
		var ch = node.childNodes[i];
		if (ch.tagName && ch.tagName.toLowerCase() == "comment" && ch.firstChild) {
			this.setComment(ch.firstChild.nodeValue);
		}
		if (ch.tagName && ch.tagName.toLowerCase() == "displayname" && ch.firstChild){
			this.data.displayname = ch.firstChild.nodeValue;
		}
	}
	//重新setTitle是因为要判断加上displayname
	this.setTitle(name);
}

SQL.Row.prototype.toXML = function() {
	var xml = "";
	
	var t = this.getTitle().replace(/"/g,"&quot;");
	var nn = (this.data.nll ? "1" : "0");
	var ai = (this.data.ai ? "1" : "0");
	xml += '<row name="'+t+'" null="'+nn+'" autoincrement="'+ai+'">\n';

	var elm = this.getDataType();
	var t = elm.getAttribute("sql");
	if (this.data.size.length) { t += "("+this.data.size+")"; }
	xml += "<datatype>"+t+"</datatype>\n";
	
	if (this.data.def || this.data.def === null) {
		var q = elm.getAttribute("quote");
		var d = this.data.def;
		if (d === null) { 
			d = "NULL"; 
		} else if (d != "CURRENT_TIMESTAMP") { 
			d = q+d+q; 
		}
		xml += "<default>"+SQL.escape(d)+"</default>";
	}

	for (var i=0;i<this.relations.length;i++) {
		var r = this.relations[i];
		if (r.row2 != this) { continue; }
		xml += '<relation table="'+r.row1.owner.getTitle()+'" row="'+r.row1.getTitle()+'" />\n';
	}

	if (this.data.displayname){
		xml += "<displayname>"+SQL.escape(this.data.displayname)+"</displayname>\n";
	}
	
	if (this.data.comment) { 
		xml += "<comment>"+SQL.escape(this.data.comment)+"</comment>\n"; 
	}
	
	xml += "</row>\n";
	return xml;
}

SQL.Row.prototype.fromXML = function(node) {
	var name = node.getAttribute("name");
	
	var obj = { type:0, size:"" };
	obj.nll = (node.getAttribute("null") == "1");
	obj.ai = (node.getAttribute("autoincrement") == "1");
	
	var cs = node.getElementsByTagName("comment");
	if (cs.length && cs[0].firstChild) { obj.comment = cs[0].firstChild.nodeValue; }
	
	var d = node.getElementsByTagName("datatype");
	if (d.length && d[0].firstChild) { 
		var s = d[0].firstChild.nodeValue;
		var r = s.match(/^([^\(]+)(\((.*)\))?.*$/);
		var type = r[1];
		if (r[3]) { obj.size = r[3]; }
		var types = window.DATATYPES.getElementsByTagName("type");
		for (var i=0;i<types.length;i++) {
			var sql = types[i].getAttribute("sql");
			var re = types[i].getAttribute("re");
			if (sql == type || (re && new RegExp(re).exec(type)) ) { obj.type = i; }
		}
	}
	
	var elm = DATATYPES.getElementsByTagName("type")[obj.type];
	var d = node.getElementsByTagName("default");
	if (d.length && d[0].firstChild) { 
		var def = d[0].firstChild.nodeValue;
		obj.def = def;
		var q = elm.getAttribute("quote");
		if (q) {
			var re = new RegExp("^"+q+"(.*)"+q+"$");
			var r = def.match(re);
			if (r) { obj.def = r[1]; }
		}
	}

	var displayname = node.getElementsByTagName('displayname');
	if(displayname && displayname.length && displayname[0].firstChild){
		obj.displayname = displayname[0].firstChild.nodeValue;
	}

	this.update(obj);
	this.setTitle(name);
}


$(document).ready(function(){
	//SQL.UI.setupUIBar();
})
