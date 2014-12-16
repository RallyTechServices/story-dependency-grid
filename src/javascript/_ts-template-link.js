 Ext.define('Rally.technicalservices.renderer.template.LinkTemplate', {
        extend: 'Ext.XTemplate',
        requires: ['Rally.nav.DetailLink'],

        /**
         * @cfg {Boolean}
         * Whether to show the icon next to the formatted id
         */
        showIcon: true,

        constructor: function(config) {
            return this.callParent([
                '<span class="formatted-id-template">{[this.createIcon(values)]}{[this.createDetailLink(values)]}</span>',
                config
            ]);
        },

        createDetailLink: function(data) {
            var modified_data = Ext.clone(data);
            if (this.refField != '_ref'){
                modified_data['_ref'] = data[this.refField];
            }
            if (this.dataType){
                data['_type'] = this.dataType;
            }

            return Rally.nav.DetailLink.getLink({
                record: modified_data,
                text: modified_data[this.textField],
                showHover: !!this.showHover
            });
        },

        createIcon: function(data){
            if (this.showIcon === false) {
                return '';
            }
            var className = '';
            switch (data._type) {
                case 'userstory':
                case 'hierarchicalrequirement':
                    className = 'story';
                    break;
                case 'defect':
                    className = 'defect';
                    break;
                case 'task':
                    className = 'task';
                    break;
                case 'testcase':
                    className = 'test-case';
                    break;
                case 'defectsuite':
                    className = 'defect-suite';
                    break;
                case 'testset':
                    className = 'test-set';
                    break;
            }

            return className ? '<span class="artifact-icon icon-' + className + '"></span>' : className;
        }
    });