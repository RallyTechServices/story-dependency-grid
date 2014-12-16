Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'criteria_box'},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        
        //Hydrate Iterations
        
        this.down('#criteria_box').add({
            xtype:'rallyreleasecombobox',
            fieldLabel: 'Release',
            labelAlign: 'right',
            width: 400,
            storeConfig: {
                context: {projectScopeDown: true}
            },
            listeners: {
                scope: this,
                change: this._updateRelease
            }
        });
        
        
    },
    _updateRelease: function(cb, newValue){
        this.logger.log('_updateRelease', cb, newValue);
         
        var filters = Ext.create('Rally.data.wsapi.Filter', {
            property: 'Predecessors.ObjectID',
            operator: '!=',
            value: null
        });
        filters = filters.and(Ext.create('Rally.data.wsapi.Filter', {
            property: 'Release',
            operator: '=',
            value: newValue
        }));
        
        var store = Ext.create('Rally.data.wsapi.Store', {
            model: 'HierarchicalRequirement',
            fetch: ['FormattedID','Name','Project','ScheduleState','Iteration', 'StartDate','EndDate','Predecessors'],
            autoLoad: true,
            filters:filters,
            listeners: {
                scope: this,
                load: function(store,data,success){
                    this.logger.log('_updateRelease store loaded', store, data, success);
                    this._fetchPredecessorData(store, data).then({
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
            columnCfgs: predecessor_data.columns
        });
        
    },
    _getDependencyGridColumns: function(){
        var tpl = '{PBlocked},{PIteration.Name}';
        var columns = [{
            text: 'FormattedID',
            dataIndex: 'FormattedID'
        },{
            text: 'Name',
            dataIndex: 'Name',
            flex: 1
        },{
            text: 'ScheduleState',
            dataIndex: 'ScheduleState'
        },{
            text: 'Project',
            dataIndex: 'Project',
            renderer: function(v,m,r){
                return r.get('Project').Name;
            }
        },{
            text: 'Predecessor FormattedID',
            dataIndex: 'PFormattedID'
        },{
            text: 'Predecessor Name',
            dataIndex: 'PName',
            flex: 1
        },{
            text: 'Predecessor Project',
            dataIndex: 'PProject',
            renderer: function(v,m,r){
                return r.get('Project').Name;
            }
        },{
            scope: this,
            text:'Predecessor Status',
            dataIndex: 'PFormattedID',
            flex: 1,
            renderer: this._displayPredecessorStatus
        }];
        
        return columns;
    },
    _displayPredecessorStatus: function(v, m, r){
        this.logger.log('_displayPredecessorStatus',v,m,r);
        
        var predecessor_schedule_state = r.get('PScheduleState');
        var predecessor_project= r.get('PProject').Name;
        var predecessor_iteraiton = r.get('PIteration');
        var predecessor_blocked = r.get('PBlocked');
        var predecessor_iteration_start_date = Rally.util.DateTime.fromIsoString(r.get('PIteration').StartDate);
        var predecessor_iteration_end_date = Rally.util.DateTime.fromIsoString(r.get('PIteration').EndDate);
        var iteration_start_date = Rally.util.DateTime.fromIsoString(r.get('Iteration').StartDate); 
        
        var predecessorHtml = '<div class="predecessor-container"><div class="predecessor-status"><div class="state-legend';
        if (r.get('PBlocked')){
            predecessorHtml += "-blocked";
        }
        predecessorHtml += '" title="' + predecessor_schedule_state + '">';
        predecessorHtml += this.getStateAbbreviation(predecessor_schedule_state);
        predecessorHtml += '</div></div><div class="predecessor">Waiting on <b>' + predecessor_project +
        '</b> for <br/>' + r.get('PFormattedID') + '<br/><span class="statusDescription">';
        var warningImageHtml = '<img src="/slm/images/icon_alert_sm.gif" alt="Warning" title="Warning" /> ';
        //that.createArtifactLink(predecessor)
        //Display the status of the predecessor
        if (predecessor_iteraiton === null) {
            predecessorHtml += warningImageHtml + "Not yet scheduled";
        } else if (predecessor_schedule_state == "Accepted") {
            predecessorHtml += "Accepted in " + predecessor_iteraiton.Name +
                    " for " + Rally.util.DateTime.formatWithDefault(predecessor_iteration_end_date);
        } else if (predecessor_blocked) {
            predecessorHtml += warningImageHtml + "Blocked";
        } else if (predecessor_iteration_end_date > iteration_start_date){
            predecessorHtml += warningImageHtml + "Scheduled for " +
            Rally.util.DateTime.formatWithDefault(predecessor_iteration_end_date) + " - too late";
        } else {
            predecessorHtml += "Scheduled for " + Rally.util.DateTime.formatWithDefault(predecessor_iteration_end_date);
        }
        
        //displayElement.innerHTML += predecessorHtml + '</span></div></div>';
        return  predecessorHtml + '</span></div></div>';
    },
    _fetchPredecessorData: function(store, data){
        this.logger.log('_fetchPredecessorData',store.fetch);
        
        var deferred = Ext.create('Deft.Deferred');
        
        var story_fetch = store.fetch;
        var predecessor_fetch = ['FormattedID','Name','Project','Blocked','ScheduleState','Iteration'];
        var ignore_fields = ['Predecessors','Iteration.StartDate'];

        var iteration_hash = {};  
        
        var promises = [];
        Ext.each(data, function(d){
            console.log('iteration - ',d.get('Iteration'));
            if (!Ext.Array.contains(Object.keys(iteration_hash),d.get('Iteration')._ref)){
                var iid = d.get('Iteration')._ref;
                iteration_hash[iid] = d.get('Iteration');  
            }
            promises.push(d.getCollection('Predecessors').load({
                fetch: predecessor_fetch,
                context: {project: null}
            }));
        },this);

        var predecessor_data = []; 
        if (promises.length == 0){
            
            var predecessor_store = Ext.create('Rally.data.custom.Store',{
                data: predecessor_data
            });
            deferred.resolve({store: predecessor_store, columns: this._getDependencyGridColumns()});
        }
        
        var iterations_needed = [];
        Deft.Promise.all(promises).then({
            scope: this,
            success: function(return_data){
                for (var i=0; i<data.length; i++){
                    console.log(data[i].get('FormattedID'),return_data[i]);
                    for (var j=0; j<return_data[i].length; j++){
                        var predecessor_rec = {};
                        Ext.each(story_fetch, function(f){
                            if (!Ext.Array.contains(ignore_fields,f)){
                                predecessor_rec[f] = data[i].get(f);
                            }
                        });
                        predecessor_rec['PFormattedID'] = return_data[i][j].get('FormattedID');
                        predecessor_rec['PName'] = return_data[i][j].get('Name');
                        predecessor_rec['PProject'] = return_data[i][j].get('Project');
                        predecessor_rec['PScheduleState'] = return_data[i][j].get('ScheduleState');
                        predecessor_rec['PBlocked'] = return_data[i][j].get('Blocked');
                        
                        var iteration_id = return_data[i][j].get('Iteration')._ref;
                        if (iteration_hash[iteration_id]){
                            predecessor_rec['PIteration']=iteration_hash[iteration_id];
                        } else {
                            if (!Ext.Array.contains(iterations_needed,iteration_id)){
                                iterations_needed.push(iteration_id);
                            }
                        }
                        predecessor_data.push(predecessor_rec);
                    }
                }
                
                if (iterations_needed.length > 0){
                    console.log('iterations needed', iterations_needed,iteration_hash);
                }
                var predecessor_store = Ext.create('Rally.data.custom.Store',{
                    data: predecessor_data
                });
                deferred.resolve({store: predecessor_store, columns: this._getDependencyGridColumns()});
            }
        });
        return deferred;  
    },
    //Private helper function to get the abbreviation
    //for the specified user story state
    getStateAbbreviation: function(state) {
        return state == "In-Progress" ? "P" : state.charAt(0);
    }
});