Ext.define('Rally.technicalservices.model.PredecessorStatus', {
   // extend:  'Ext.data.Model',
    /*
     * Record needs to contain:  
     *   FormattedID
     *   Name
     *   Project {Name}
     *   Iteration {StartDate, EndDate, Name}
     *   ScheduleState
     *   PFormattedID
     *   PName
     *   PProject {Name}
     *   PIteration {Name, StartDate, EndDate}
     *   PScheduleState
     * 
     */
    record: null,
    
    constructor: function(config){
        this.record = config.record;  
    },
    
    getStatusSummary: function(){
        return Ext.String.format("Waiting on {0} for {1}\n", this.record.PProject.Name, this.record.PFormattedID);
    },
    getStatusInfo: function(){
        if (this.getStatusWarning().length > 0){
            return '';
        }
        var pIterationEndDate = Rally.util.DateTime.fromIsoString(this.record.PIteration.EndDate);
        return Ext.String.format("Scheduled for {0}\n",Rally.util.DateTime.formatWithDefault(pIterationEndDate));
    },
    getStatusWarning: function(){
        
        var pIterationEndDate = Rally.util.DateTime.fromIsoString(this.record.PIteration.EndDate);
        var storyStartDate = Rally.util.DateTime.fromIsoString(this.record.Iteration.StartDate);
        var status = '';
        
        if (this.record.PIteration === null) {
            status += "Warning:  Not yet scheduled\n";
        } else if (this.record.PScheduleState == "Accepted") {
            status += Ext.String.format("Accepted in {0} for {1}\n",this.record.PIteration.Name,Rally.util.DateTime.formatWithDefault(pIterationEndDate));
        } else if (this.record.PBlocked) {
            status += "Warning: Blocked\n";
        } else if (pIterationEndDate > storyStartDate){
            status += Ext.String.format("Warning: Scheduled for {0} -- too late.\n",Rally.util.DateTime.formatWithDefault(pIterationEndDate));
        }
        return status; 
    },
    getExportableStatus: function(){
        //strip out \n and append quotes.  
        var exportable_status = Ext.String.format("{0} {1} {2}",this.getStatusSummary(), this.getStatusWarning() , this.getStatusInfo());
        return exportable_status.replace(/\n/g,"");
    },
    statics:{
        getStatusTpl: function(){
            return '<div class="predecessor-container"><div class="predecessor">{PStatusSummary}<br>' +
            '<span class="statusDescription">{PStatusInfo}' + 
            '<tpl if={PStatusWarning}><img src="/slm/images/icon_alert_sm.gif" alt="Warning" title="Warning" />{PStatusWarning}</tpl>' +
            '</span></div></div>';
        }
    }
});