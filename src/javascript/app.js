Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'criteria_box', layout: {type: 'hbox'}, padding: 10},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    storeFetch: ['ObjectID','FormattedID','Name','Project','ScheduleState','Iteration', 'StartDate','EndDate','Predecessors', 'Feature'],
    predecessorFetch: ['FormattedID','Name','Project','Blocked','ScheduleState','Iteration','StartDate','EndDate','Feature'],
    columnHeaders: {
        Feature: 'Feature ID',
        FormattedID: 'ID',
        Name: 'Name',
        Project: 'Project',
        Iteration: 'Iteration',
        ScheduleState: 'State',
        PFeatureID: 'Predecessor Feature ID',
        PFormattedID: 'Predecessor ID',
        PName: 'Name',
        PProject: 'Project',
        PIteration: 'Iteration',
        PScheduleState: 'State',
        PStatus: 'Status'
        },
    launch: function() {

        this.down('#criteria_box').add({
            xtype:'rallyreleasecombobox',
            fieldLabel: 'Release',
            labelAlign: 'right',
            width: 400,
            storeConfig: {
                context: {projectScopeDown: false}
            },
            listeners: {
                scope: this,
                change: this._updateRelease
            }
        });
        
        this.down('#criteria_box').add({
            xtype: 'rallybutton',
            text: 'Export',
            scope: this,
            handler: this._exportData
        });
    },
    _exportData: function(){
        var file_name = 'story-dependencies.csv';
        var text = Rally.technicalservices.FileUtilities.convertDataArrayToCSVText(this.exportData, this.columnHeaders);
        Rally.technicalservices.FileUtilities.saveTextAsFile(text,file_name);
    },
    _updateRelease: function(cb, newValue){
        this.logger.log('_updateRelease', cb, newValue);
         
        var filters = Ext.create('Rally.data.wsapi.Filter', {
            property: 'Predecessors.ObjectID',
            operator: '!=',
            value: null
        });
        filters = filters.and(cb.getQueryFromSelected());
        
       Ext.create('Rally.data.wsapi.Store', {
            model: 'HierarchicalRequirement',
            fetch: this.storeFetch,
            autoLoad: true,
            filters:filters,
            listeners: {
                scope: this,
                load: function(store,data,success){
                    this.logger.log('_updateRelease store loaded', store, data, success);
                    
                    this._buildCustomDataStore(store, data).then({
                        scope: this,
                        success: this._updateDependencyGrid
                    });
                }
            }
        });
        
    },
    _updateDependencyGrid: function(predecessor_data){
        this.logger.log('_updateDependencyGrid');
        if (this.down('#grid-dependencies')){
            this.down('#grid-dependencies').destroy();
        }
        
        this.down('#display_box').add({
            xtype: 'rallygrid',
            itemId: 'grid-dependencies',
            store: predecessor_data.store,
            columnCfgs: predecessor_data.columns,
            viewConfig: {
                stripeRows: false
            }
        });
        
    },
    _getDependencyGridColumns: function(){
        var tpl_formattedid = Ext.create('Rally.technicalservices.renderer.template.LinkTemplate', {
            refField: '_ref',
            textField: 'FormattedID',
            dataType: 'userstory'
        });
        var tpl_predecessor_formattedid = Ext.create('Rally.technicalservices.renderer.template.LinkTemplate', {
            refField: 'P_ref',
            textField: 'PFormattedID',
            dataType: 'userstory'
        })
        
        var columns = [{
            text: 'Feature ID',
            dataIndex: 'Feature',
            renderer: function(v,m,r){                
                if (r.get('Feature')){
                    return r.get('Feature').FormattedID;
                }
                return '';
            }
        },{
            scope: this,
            xtype: 'templatecolumn',
            text: this.columnHeaders['FormattedID'],
            dataIndex: 'FormattedID',
            tpl: tpl_formattedid
        },{
            text: this.columnHeaders['Name'],
            dataIndex: 'Name',
            flex: 1
        },{
            text: this.columnHeaders['ScheduleState'],
            dataIndex: 'ScheduleState'
        },{
            text: this.columnHeaders['Iteration'],
            dataIndex: 'Iteration',
            renderer: function(v,m,r){                
                if (r.get('Iteration')){
                    return r.get('Iteration').Name;
                }
                return '';
            }
        },{
            text: this.columnHeaders['Project'],
            dataIndex: 'Project',
            renderer: function(v,m,r){
                return r.get('Project').Name;
            }
        },{
            text: this.columnHeaders['PFeatureID'],
            dataIndex: 'PFeatureID',
            tdCls: 'tspredecessor',
        },{
            xtype: 'templatecolumn',
            text: this.columnHeaders['PFormattedID'],
            dataIndex: 'PFormattedID',
            tpl: tpl_predecessor_formattedid,
            tdCls: 'tspredecessor'
        },{
            text: this.columnHeaders['PName'],
            dataIndex: 'PName',
            flex: 1,
            tdCls: "tspredecessor"
        },{
            text: this.columnHeaders['PIteration'],
            dataIndex: 'PIteration',
            renderer: function(v,m,r){
                m.tdCls = "tspredecessor";
                if (r.get('PIteration')){
                    return r.get('PIteration').Name;
                }
                return '';
                
            }
        },{
            text: this.columnHeaders['PProject'],
            dataIndex: 'PProject',
            renderer: function(v,m,r){
                m.tdCls = "tspredecessor";
                return r.get('PProject').Name;
            }
        },{
            text: this.columnHeaders['PScheduleState'],
            dataIndex: 'PScheduleState',
            tdCls: "tspredecessor"
        },{
            scope: this,
            xtype: 'templatecolumn',
            text: this.columnHeaders['PStatus'],
            dataIndex: 'PStatus',
            flex: 1,
            tdCls: "tspredecessor",
            tpl: Rally.technicalservices.model.PredecessorStatus.getStatusTpl()
        }];
        return columns;
    },
    _buildCustomDataStore: function(store, data){
        this.logger.log('_buildCustomDataStore',store.fetch);        
        var deferred = Ext.create('Deft.Deferred');
        
        var story_fetch = this.storeFetch;
        var predecessor_fetch = this.predecessorFetch;

        var stories = []; 
        var promises = [];
        
        var object_ids = []; //Array of ObjectIDs so we keep track of what has been loaded already
        Ext.each(data, function(d){
            if (!Ext.Array.contains(object_ids, d.get('ObjectID'))){
                object_ids.push(d.get('ObjectID'));
                var store = d.getCollection('Predecessors',{
                    fetch: predecessor_fetch,
                    context: {project: null}
                });
                promises.push(store.load());
                var story = {};
                Ext.each(story_fetch, function(field){
                  story[field] = d.get(field);
                },this);
                story['_ref']=d.get('_ref'); //Need this for the renderer to work properly
                stories.push(story);
            }
        },this);
        
        this._fetchPredecessorData(stories, promises).then({
            scope: this,
            success: function(predecessor_data){
                
                Ext.each(predecessor_data, function(d){
                    var pd = Ext.create('Rally.technicalservices.model.PredecessorStatus', {record: d});
                    d['PStatusSummary'] = pd.getStatusSummary();
                    d['PStatusInfo'] = pd.getStatusInfo();
                    d['PStatusWarning'] = pd.getStatusWarning();
                    d['PStatus'] = pd.getExportableStatus();
                },this);
                
                var predecessor_store = Ext.create('Rally.data.custom.Store',{
                    data: predecessor_data,
                    //pageSize: 200
                });
                this.exportData = predecessor_data;
                deferred.resolve({store: predecessor_store, columns: this._getDependencyGridColumns()});
            }
        });
        return deferred;  
    },
    _fetchPredecessorData: function(stories, promises){
        this.logger.log('_fetchPredecessorData');
        var deferred = Ext.create('Deft.Deferred');
        var predecessor_data = []; 
        if (promises.length == 0){
            var predecessor_store = Ext.create('Rally.data.custom.Store',{
                data: predecessor_data
            });
            deferred.resolve(predecessor_data);
        } else {
            var iterations_needed = [];
            Deft.Promise.all(promises).then({
                scope: this,
                success: function(return_data){
                    this.logger.log('_fetchPredecessorData promises returned', return_data);
                    
                    for (var i=0; i<stories.length; i++){ 
                        for (var j=0; j<return_data[i].length; j++){
                            var predecessor_rec = Ext.clone(stories[i]);
                            predecessor_rec['PFeatureID'] = '';
                            if (return_data[i][j].get('Feature')){
                                predecessor_rec['PFeatureID'] = return_data[i][j].get('Feature').FormattedID;
                            }
                            predecessor_rec['PFormattedID'] = return_data[i][j].get('FormattedID');
                            predecessor_rec['PName'] = return_data[i][j].get('Name');
                            predecessor_rec['PProject'] = return_data[i][j].get('Project');
                            predecessor_rec['PScheduleState'] = return_data[i][j].get('ScheduleState');
                            predecessor_rec['PBlocked'] = return_data[i][j].get('Blocked');
                            if (return_data[i][j].get('Iteration')) {
                                predecessor_rec['PIteration']={
                                        Name: return_data[i][j].get('Iteration').Name,
                                        StartDate: return_data[i][j].get('Iteration').StartDate,
                                        EndDate: return_data[i][j].get('Iteration').EndDate
                                 }  
                            }
                            predecessor_rec['P_ref'] = return_data[i][j].get('_ref');
                            predecessor_data.push(predecessor_rec);
                        }
                    }
                    deferred.resolve(predecessor_data);
                }
            });        
        }
        return deferred;  
    }
});