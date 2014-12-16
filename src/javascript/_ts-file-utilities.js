Ext.define('Rally.technicalservices.FileUtilities', {
    singleton: true,
    logger: new Rally.technicalservices.Logger(),
    
    saveTextAsFile: function(textToWrite, fileName)
    {
        var textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
        var fileNameToSaveAs = fileName;

        var downloadLink = document.createElement("a");
        downloadLink.download = fileNameToSaveAs;
        downloadLink.innerHTML = "Download File";
        if (window.webkitURL != null)
        {
            // Chrome allows the link to be clicked
            // without actually adding it to the DOM.
            downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
        }
        else
        {
            // Firefox requires the link to be added to the DOM
            // before it can be clicked.
            downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
            downloadLink.onclick = destroyClickedElement;
            downloadLink.style.display = "none";
            document.body.appendChild(downloadLink);
        }
        downloadLink.click();
    },
    destroyClickedElement: function(event)
    {
        document.body.removeChild(event.target);
    },
    convertCustomStoreToCSVText: function(store, requestedFieldHash){
        console.log(store, store.getData());
        var text = '';
        Ext.each(Object.keys(requestedFieldHash), function(key){
            text += requestedFieldHash[key] + ',';
        });
        text = text.replace(/,$/,'\n');
        
        Ext.each(store.getData().items, function(d){
            Ext.each(Object.keys(requestedFieldHash), function(key){
                if (typeof d.get(key) === 'object'){
                    text += Ext.String.format("\"{0}\",",d.get(key).Name );                    
                } else {
                    text += Ext.String.format("\"{0}\",",d.get(key) );                    
                }
            },this);
            text = text.replace(/,$/,'\n');
        },this);
        return text;
    }
});