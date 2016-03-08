angular.module("visit", [ "filters", "constants", "visit-templates", "visitService", "encounterService", "obsService",
    "allergies", "vaccinations", "ui.bootstrap", "ui.router", "session", "ngDialog", "appFramework",
    "configService", 'pascalprecht.translate'])

    .config(function ($stateProvider, $urlRouterProvider, $translateProvider) {

        $urlRouterProvider.otherwise("overview");

        $stateProvider
            .state("overview", {
                url: "/overview",
                templateUrl: "templates/overview.page",
                onEnter: function() {
                    breadcrumbs = breadcrumbsOverview;
                    emr.updateBreadcrumbs();
                }
            })
            .state("visitList", {
                url: "/visitList",
                templateUrl: "templates/visitList.page"
            })

        $translateProvider
            .useUrlLoader('/' + OPENMRS_CONTEXT_PATH + '/module/uicommons/messages/messages.json')
            .useSanitizeValueStrategy('escape');  // TODO is this the correct one to use http://angular-translate.github.io/docs/#/guide/19_security

    })

    .directive("dateWithPopup", [ function() {
        return {
            restrict: 'E',
            scope: {
                ngModel: '=',
                minDate: '=',
                maxDate: '='
            },
            controller: function($scope) {
                $scope.now = new Date();
                $scope.opened = false;
                $scope.open = function(event) {
                    event.preventDefault();
                    event.stopPropagation();
                    $scope.opened = true;
                }
                $scope.options = { // for some reason setting this via attribute doesn't work
                    showWeeks: false
                }
            },
            template: '<span class="angular-datepicker">' +
                        '<input type="text" is-open="opened" ng-model="ngModel" datepicker-popup="dd-MMM-yyyy" readonly ' +
                        'datepicker-options="options" min-date="minDate" max-date="maxDate" ng-click="open($event)"/>' +
                        '<i class="icon-calendar small add-on" ng-click="open($event)" ></i>' +
                        '</span>'
        }
    }])

    // This is not a reusable directive. It does not have an isolate scope, but rather inherits scope from VisitController
    .directive("displayElement", [
        function() {
        return {
            restrict: 'E',
            controller: function($scope) {

                var element = $scope.element;

                if (element.type === 'encounter') {
                    $scope.encounters = element.encounters;
                    $scope.template = "templates/visitElementEncounter.page";

                }
                else if (element.type === 'consult-section') {
                    $scope.section = element;
                    $scope.template = "templates/visitElementSection.page";
                }
                else if (element.type === 'include') {
                    $scope.template = element.include;
                }
                else {
                    $scope.type = element.type;
                    $scope.template = "templates/visitElementNotYetImplemented.page";
                }
            },
            template: '<div ng-include="template"></div>'
        }
    }])

    .directive("encounter", [ "Encounter", "VisitTemplateService", "Concepts", "DatetimeFormats", "SessionInfo", "$http", "$sce",
        function(Encounter, VisitTemplateService, Concepts, DatetimeFormats, SessionInfo, $http, $sce) {
            return {
                restrict: "E",
                scope: {
                    encounterStub: "=encounter",
                    encounterDateFormat: "="
                },
                controller: ["$scope", function($scope) {
                    function loadFullEncounter() {

                        // load standard OpenMRS REST representation of an object
                        Encounter.get({ uuid: $scope.encounterStub.uuid, v: "full" }).
                            $promise.then(function(encounter) {
                                $scope.encounter = encounter;
                            });

                        // if the display templates for this encounter-type require a special model, fetch it (only use case now is the "encounter-in-hfe-schema" model provided by HFE)
                        if ($scope.templateModelUrl()) {
                            var url = Handlebars.compile($scope.templateModelUrl())({
                                encounter: $scope.encounter
                            });
                            $http.get("/" + OPENMRS_CONTEXT_PATH + url)
                                .then(function (response) {
                                    $scope.templateModel = response.data;
                                    if ($scope.templateModel.html) {
                                        // this enabled the "viewEncounerWithHtmlFormLong" view to display raw html returned by the htmlformentryui module
                                        $scope.html = $sce.trustAsHtml($scope.templateModel.html);
                                        $scope.doesNotHaveExistingObs = !$scope.templateModel.hasExistingObs;
                                    }
                                });
                            // TODO error handling
                        }

                        //$scope.orders = OrderEntryService.getOrdersForEncounter($scope.encounterStub);
                    }

                    $scope.DatetimeFormats = DatetimeFormats;
                    $scope.Concepts = Concepts;
                    $scope.session = SessionInfo.get();

                    $scope.encounter = $scope.encounterStub;

                    var config = VisitTemplateService.getConfigFor($scope.encounter);
                    $scope.encounterState = config ? config.defaultState : "short";
                    $scope.icon = config ? config.icon : null;
                    $scope.primaryEncounterRoleUuid = config ? config.primaryEncounterRoleUuid : null;

                    $scope.templateModelUrl= function () {
                        if (config) {
                            return config["templateModelUrl"];
                        }
                        return "";  // no custom template model by default
                    }

                    $scope.canExpand = function() {
                        return $scope.encounterState === 'short' && config && config.longTemplate;
                    }

                    $scope.canContract = function() {
                        return $scope.encounterState === 'long' && config && config.shortTemplate;
                    }

                    $scope.canEdit = function() {
                        var encounter = new OpenMRS.EncounterModel($scope.encounter);
                        var currentUser = new OpenMRS.UserModel($scope.session.user);
                        return config.editUrl &&
                            (encounter.canBeEditedBy(currentUser)
                                || encounter.participatedIn($scope.session.currentProvider)
                                || encounter.createdBy(currentUser));
                    }

                    $scope.canDelete = function() {
                        var encounter = new OpenMRS.EncounterModel($scope.encounter);
                        var currentUser = new OpenMRS.UserModel($scope.session.user);
                        return config.editUrl &&
                            (encounter.canBeDeletedBy(currentUser)
                                || encounter.participatedIn($scope.session.currentProvider)
                                || encounter.createdBy(currentUser));
                    }

                    $scope.expand = function() {
                        // Get the latest representation when we expand, in case things have been edited
                        loadFullEncounter(); // TODO make this a promise with a then
                        $scope.encounterState = 'long';
                        $scope.template = config ? config["longTemplate"] : "templates/encounters/defaultEncounterLong.page"
                    }

                    $scope.contract = function() {
                        $scope.encounterState = 'short';
                        $scope.template = config ? config["shortTemplate"] : "templates/encounters/defaultEncounterShort.page"
                    }

                    $scope.edit = function() {
                        $scope.$emit("request-edit-encounter", $scope.encounter);
                    }

                    $scope.delete = function() {
                        $scope.$emit("request-delete-encounter", $scope.encounter);
                    }

                    $scope.$on('expand-all',function() {
                        if ($scope.canExpand) {
                            $scope.expand();
                        }
                    });

                    $scope.$on('contract-all',function() {
                        if ($scope.canExpand) {
                            $scope.contract();
                        }
                    });

                    if (config.defaultState == "long") {
                        loadFullEncounter();
                    }

                    $scope.template = config ? config[config.defaultState + "Template"] : "templates/encounters/defaultEncounterShort.page"
                }],
                template: '<div class="visit-element"><div ng-include="template"></div></div>'
            }
    }])

    .directive("section", [ "Concepts", "DatetimeFormats", "SessionInfo", "$http", "$sce", "$timeout",
        function(Concepts, DatetimeFormats, SessionInfo, $http, $sce, $timeout) {
            return {
                restrict: "E",
                scope: {
                    section: "=",
                    encounter: "=",
                    visit: "=",
                    encounterReady: "="
                },
                controller: ["$scope", function($scope) {

                    $scope.DatetimeFormats = DatetimeFormats;
                    $scope.Concepts = Concepts;
                    $scope.state = 'short';
                    $scope.sectionLoaded = false;
                    $scope.session = SessionInfo.get();
                    $scope.template = $scope.section.shortTemplate;

                    // don't load individual sections until we have the base encounter
                    if ($scope.encounterReady) {
                        loadSection();
                    }
                    else {
                        $scope.$watch('encounterReady', function(newVal, oldVal) {
                            if ($scope.encounterReady) {
                                loadSection();
                            }
                        });
                    }

                    function loadSection() {
                        if ($scope.encounter && $scope.section.templateModelUrl && !$scope.sectionLoaded) {
                            var url = Handlebars.compile($scope.section.templateModelUrl)({
                                consultEncounter: $scope.encounter
                            });
                            $http.get("/" + OPENMRS_CONTEXT_PATH + url)
                                .then(function (response) {
                                    $scope.sectionLoaded = true;
                                    $scope.templateModel = response.data;
                                    if ($scope.templateModel.html) {
                                        // this enabled the "viewEncounerWithHtmlFormLong" view to display raw html returned by the htmlformentryui module
                                        $scope.html = $sce.trustAsHtml($scope.templateModel.html);
                                        $scope.doesNotHaveExistingObs = !$scope.templateModel.hasExistingObs;
                                    }
                                });
                            // TODO error handling
                        }
                        else {
                            $scope.doesNotHaveExistingObs = true;
                        }
                    }

                    function openSectionForEdit() {
                        var url = Handlebars.compile($scope.section.editUrl)({
                            visit: $scope.visit,
                            consultEncounter: $scope.encounter,
                            patient: $scope.visit.patient,
                            returnUrl: window.encodeURIComponent(window.location.pathname + "?visit=" + $scope.visit.uuid)
                        });

                        emr.navigateTo({ applicationUrl: (!url.startsWith("/") ? '/' : '') + url });
                    }

                    $scope.canExpand = function() {
                        return $scope.state === 'short' && $scope.section.longTemplate;
                    }
                    $scope.canContract = function() {
                        return $scope.state === 'long';
                    }

                    $scope.canEnter = function() {
                        var currentUser = new OpenMRS.UserModel($scope.session.user);
                        return (currentUser.hasPrivilege('Task: emr.enterConsultNote') && !$scope.visit.stopDatetime)
                            || currentUser.hasPrivilege('Task: emr.retroConsultNote');
                    }

                    $scope.canEdit = function() {
                        if (!$scope.encounter) {
                            return $scope.canEnter();
                        }
                        else {
                            var encounter = new OpenMRS.EncounterModel($scope.encounter);
                            var currentUser = new OpenMRS.UserModel($scope.session.user);
                            return (encounter.canBeEditedBy(currentUser)
                            || encounter.participatedIn($scope.session.currentProvider)
                            || encounter.createdBy(currentUser));
                        }
                    }

                    $scope.expand = function() {
                        if ($scope.canExpand()) {
                            if (!$scope.sectionLoaded) {
                                loadSection();
                            }
                            $scope.template = $scope.section.longTemplate;
                            $scope.state = 'long';
                        }
                    }
                    $scope.contract = function() {
                        if ($scope.canContract()) {
                            $scope.template = $scope.section.shortTemplate;
                            $scope.state = 'short';
                        }
                    }

                    $scope.edit = function() {
                        if ($scope.encounter) {
                            openSectionForEdit();
                        }
                        else {
                            $scope.$emit('start-consult');
                            $scope.$on('consult-started', function(event, encounterUuid) {
                                $scope.encounter = {
                                    uuid: encounterUuid
                                }
                                openSectionForEdit();
                            })
                        }
                    }

                    $scope.$on('expand-all',function() {
                        if ($scope.canExpand) {
                            $scope.expand();
                        }
                    });

                    $scope.$on('contract-all',function() {
                        if ($scope.canExpand) {
                            $scope.contract();
                        }
                    });

                }],
                template: '<div class="visit-element"><div ng-include="template"></div></div>'
            }
        }])


    // this is not a reusable directive, and it does not have an isolate scope
    .directive("visitDetails", [ "Visit", "ngDialog", "$filter", function(Visit, ngDialog, $filter) {
        // TODO make sure this at least gives as error message in case of failure
        return {
            restrict: 'E',
            controller: function($scope) {
                $scope.edit = function() {
                    ngDialog.openConfirm({
                        showClose: true,
                        closeByEscape: true,
                        closeByDocument: false, // in case they accidentally click the background to close a datepicker
                        controller: [ "$scope", function($dialogScope) {
                            $dialogScope.now = new Date();
                            $dialogScope.visit = $scope.visit;
                            $dialogScope.newStartDatetime = new Date($filter('serverDate')($scope.visit.startDatetime));
                            $dialogScope.startDateLowerLimit = $scope.previousVisitEndDatetime($scope.visit);
                            $dialogScope.startDateUpperLimit = $scope.firstEncounterInVisitDatetime($scope.visit);
                            $dialogScope.endDateLowerLimit = $scope.mostRecentEncounterInVisitDatetime($scope.visit);
                            $dialogScope.endDateUpperLimit = $scope.nextVisitStartDatetime($scope.visit);
                            $dialogScope.newStopDatetime = $scope.visit.stopDatetime ? new Date($filter('serverDate')($scope.visit.stopDatetime)) : '';
                            $dialogScope.newLocation = $scope.visit.location;
                        }],
                        template: "templates/visitDetailsEdit.page"
                    }).then(function(opts) {
                        // we trim off the time zone, because we don't want to send it along: the server will just assume that it is in it's timezone
                        var start = $filter('serverDateForRESTSubmit')(moment(opts.start).startOf('day').format());
                        var stop = $filter('serverDateForRESTSubmit')(opts.stop ? moment(opts.stop).endOf('day').format() : null);
                        new Visit({
                            uuid: $scope.visit.uuid,
                            startDatetime: start,
                            stopDatetime: stop
                        }).$save(function(v) {
                                $scope.reloadVisits();
                                $scope.reloadVisit();
                        });
                    });
                }
            },
            templateUrl: 'templates/visitDetails.page'
        }
    }])

    // inherits scope from visit overview controller
    .directive("chooseVisitTemplate", [ "VisitTemplateService", "VisitAttributeTypes", "VisitService", "ngDialog", "SessionInfo",
        function(VisitTemplateService, VisitAttributeTypes, VisitService, ngDialog, SessionInfo) {
        return {
            restrict: 'E',
            controller: function($scope) {

                $scope.availableTemplates = VisitTemplateService.getAllowedVisitTemplates($scope.visit);
                $scope.activeTemplate = VisitTemplateService.getCurrent();
                $scope.multipleTemplates = $scope.availableTemplates && $scope.availableTemplates.length > 1;

                $scope.$watch("visit", function() {
                    if ($scope.visit) {
                        $scope.selectedTemplate = $scope.visit.getAttributeValue(VisitAttributeTypes.visitTemplate);
                        $scope.newVisitTemplate = _.findWhere($scope.availableTemplates, {name: $scope.selectedTemplate});
                        $scope.activeTemplate = VisitTemplateService.getCurrent();
                    }
                });

                $scope.choosingTemplate = false;
                $scope.session = SessionInfo.get();

                function confirmChangingTemplate(VisitAttribute, existing) {
                    ngDialog.openConfirm({
                        showClose: false,
                        closeByEscape: true,
                        closeByDocument: true,
                        template: "templates/confirmVisitTemplateChange.page"
                    }).then(function() {
                        // render the visit using the new selected template
                        if ($scope.newVisitTemplate ) {
                            new VisitAttribute({
                                attributeType: VisitAttributeTypes.visitTemplate.uuid,
                                value: $scope.newVisitTemplate.name
                            }).$save().then(function () {
                                    $scope.activeTemplate = $scope.newVisitTemplate;
                                    $scope.choosingTemplate = false;
                                    $scope.reloadVisit();
                                });
                        } else {
                            new VisitAttribute({uuid: existing.uuid}).$delete().then(function() {
                                $scope.reloadVisit();
                            });
                        }
                    }, function() {
                        $scope.choosingTemplate = false;
                        $scope.reloadVisit();
                    });
                }

                $scope.canChangeTemplate = function() {

                    var currentUser = new OpenMRS.UserModel($scope.session.user);

                    if ($scope.consultEncounter) {
                        var encounter = new OpenMRS.EncounterModel($scope.consultEncounter);
                        return (encounter.canBeEditedBy(currentUser)
                        || encounter.participatedIn($scope.session.currentProvider)
                        || encounter.createdBy(currentUser));
                    }
                    else {
                        return (currentUser.hasPrivilege('Task: emr.enterConsultNote') && $scope.visit && !$scope.visit.stopDatetime)
                            || currentUser.hasPrivilege('Task: emr.retroConsultNote');
                    }
                }


                $scope.save = function() {
                    var existing = $scope.visit.getAttribute(VisitAttributeTypes.visitTemplate);
                    var VisitAttribute = VisitService.visitAttributeResourceFor($scope.visit);

                    if (existing) {
                        // if we change from an existing template, prompt the user to confirm the change
                        confirmChangingTemplate(VisitAttribute, existing);
                    } else {
                        // if there is no template set then just assign the new template
                        new VisitAttribute({
                            attributeType: VisitAttributeTypes.visitTemplate.uuid,
                            value: $scope.newVisitTemplate.name
                        }).$save().then(function() {
                                $scope.choosingTemplate = false;
                                $scope.reloadVisit();
                            });
                    }
                };
            },
            templateUrl: 'templates/chooseVisitTemplate.page'
        }
    }])

    .directive("visitListDropdown", [ function() {
        return {
            templateUrl: 'templates/visitListDropdown.page'
        }
    }])

    .directive("visitActionsDropdown", [ function() {
        return {
            templateUrl: 'templates/visitActionsDropdown.page'
        }
    }])

    .service("VisitTemplateService", [ "VisitTemplates", "VisitAttributeTypes", "Encounter","ConfigService",
        function(VisitTemplates, VisitAttributeTypes, Encounter, ConfigService) {

            var currentTemplate = null;

            // TODO what if this is not populated in time?
            var visitTemplates;
            ConfigService.getVisitTemplates().then(function (templates) {
                visitTemplates = templates;
            })

            return {
                getAllowedVisitTemplates: function(visit) {
                    return _.filter(
                        _.map(visitTemplates, function(visitTemplate) {
                            return VisitTemplates[visitTemplate];
                        }), function(it) {
                            return it.allowedFor(visit);
                        });
                },

                setCurrent: function(visitTemplate) {
                    currentTemplate = visitTemplate;
                },

                getCurrent: function() {
                    return currentTemplate;
                },

                getConfigFor: function(encounter) {
                    if (currentTemplate && currentTemplate.encounterTypeConfig) {
                        var config = currentTemplate.encounterTypeConfig[encounter.encounterType.uuid];
                        return config ? config : currentTemplate.encounterTypeConfig.DEFAULT;
                    }
                    return null;
                },

                determineFor: function(visit) {
                    var specified = new OpenMRS.VisitModel(visit).getAttributeValue(VisitAttributeTypes.visitTemplate);
                    if (specified && VisitTemplates[specified]) {
                        return angular.copy(VisitTemplates[specified]);
                    }
                    else {
                        //var template = visit.patient.person.age < 15 ? "pedsInitialOutpatient" : "adultInitialOutpatient";
                        var template = "timeline";
                        return angular.copy(VisitTemplates[template]);
                    }
                },

                applyVisit: function(visitTemplate, visit) {
                    this.setCurrent(visitTemplate);
                    _.each(visitTemplate.elements, function(it) {
                        if (it.type == 'encounter') {    // find any encounters associated with this element
                            it.encounters = _.filter(visit.encounters, function(candidate) {
                                // TODO support finding by form as well?
                                return candidate.encounterType.uuid === it.encounter.encounterType.uuid;
                            });
                        }
                    });
                },

                getConsultEncounterType: function() {
                    if (currentTemplate && currentTemplate.consultEncounterType) {
                        return currentTemplate.consultEncounterType;
                    }
                    else {
                        return null;
                    }
                }

            }
        }])

    .controller("VisitController", [ "$scope", "$rootScope", "$translate","$http", "Visit", "VisitTemplateService", "$state",
        "$timeout", "$filter", "ngDialog", "Encounter", "AppFrameworkService",
        'visitUuid', 'patientUuid', 'locale', "DatetimeFormats", "EncounterTransaction", "SessionInfo", "Concepts", "EncounterRoles",
        function($scope, $rootScope, $translate, $http, Visit, VisitTemplateService, $state, $timeout, $filter,
                 ngDialog, Encounter, AppFrameworkService, visitUuid, patientUuid, locale, DatetimeFormats,
                 EncounterTransaction, SessionInfo, Concepts, EncounterRoles) {

            $rootScope.DatetimeFormats = DatetimeFormats;
            $scope.Concepts = Concepts;

            $scope.session = SessionInfo.get();

            $scope.visitUuid = visitUuid;
            $scope.patientUuid = patientUuid;
            $scope.consultEncounter = null;
            $scope.consultEncounterReady = false;

            $scope.printButtonDisabled = false;
            $scope.allExpanded = false;

            loadVisits(patientUuid);
            loadVisit(visitUuid);

            $translate.use(locale);

            function sameDate(d1, d2) {
                return d1 && d2 && d1.substring(0, 10) == d2.substring(0, 10);
            }

            function loadVisits(patientUuid) {
                Visit.get({patient: $scope.patientUuid, v: "custom:(uuid,startDatetime,stopDatetime)"}).$promise.then(function(response) {

                    // load a minimal list of visits first, so we can begin to render the visit list page
                    $scope.visits = response.results;

                    // now load a bigger list so that we can fill out template, diagnoses and encounters
                    Visit.get({
                        patient: $scope.patientUuid,
                        v: "custom:(uuid,startDatetime,stopDatetime,location:ref,encounters:(uuid,display,encounterDatetime,location:ref,encounterType:ref,obs:default,voided),attributes:default)"
                    }).$promise.then(function (response) {
                        // fetch the template for each visit, which we display on the visit list
                        _.each(response.results, function (visit) {
                            visit.visitTemplate = VisitTemplateService.determineFor(visit);
                            visit.encounters =  _.reject(visit.encounters, function(it) { return it.voided; });
                        })
                        $scope.visits = response.results;
                    });
                });
            }

            function loadVisit(visitUuid) {
                if (visitUuid) {
                    Visit.get({
                            uuid: visitUuid,
                            v: "custom:(uuid,startDatetime,stopDatetime,location:ref,encounters:(uuid,display,encounterDatetime,patient:default,location:ref,form:ref,encounterType:ref,obs:ref,orders:ref,voided,visit:ref,encounterProviders,creator),patient:default,visitType:ref,attributes:default)"
                        })
                        .$promise.then(function (visit) {
                        visit.encounters = _.reject(visit.encounters, function (it) {
                            return it.voided;
                        });
                        $scope.visit = new OpenMRS.VisitModel(visit);
                        $scope.visitIdx = $scope.getVisitIdx(visit);
                        $scope.encounterDateFormat = sameDate($scope.visit.startDatetime, $scope.visit.stopDatetime) ? "hh:mm a" : "hh:mm a (d-MMM)";
                        $scope.visitTemplate = VisitTemplateService.determineFor($scope.visit);
                        VisitTemplateService.applyVisit($scope.visitTemplate, $scope.visit);

                        $scope.consultEncounter = VisitTemplateService.getConsultEncounterType() ? $scope.visit.getEncounterByType(VisitTemplateService.getConsultEncounterType().uuid) : null;
                        if ($scope.consultEncounter) {
                            loadConsultEncounter();
                        }
                        else {
                            // no consult encounter, so automatically "ready"
                            $scope.consultEncounterReady = true;
                        }

                        AppFrameworkService.getUserExtensionsFor("patientDashboard.visitActions").then(function (ext) {
                            $scope.visitActions = ext;
                        })

                    });
                }
            }

            function loadConsultEncounter() {
                // load standard OpenMRS REST representation of an object
                Encounter.get({ uuid: $scope.consultEncounter.uuid, v: "full" }).
                    $promise.then(function(encounter) {
                        $scope.consultEncounter = encounter;
                        $scope.consultEncounterReady = true;
                    });
            }

            $rootScope.$on("request-edit-encounter", function(event, encounter) {
                var config = VisitTemplateService.getConfigFor(encounter);
                if (config.editUrl) {
                    var url = Handlebars.compile(config.editUrl)({
                        patient: encounter.patient,
                        visit: $scope.visit,
                        encounter: encounter,
                        breadcrumbOverride: encodeURIComponent(JSON.stringify(breadcrumbOverride)),
                        returnUrl: "/" + OPENMRS_CONTEXT_PATH + "/pihcore/visit/visit.page?visit=" + $scope.visit.uuid
                    });
                    emr.navigateTo({applicationUrl: url});
                }
            });

            $rootScope.$on("request-delete-encounter", function(event, encounter) {
                ngDialog.openConfirm({
                    showClose: true,
                    closeByEscape: true,
                    closeByDocument: true,
                    controller: function($scope) {
                       /* OrderEntryService.getOrdersForEncounter(encounter).$promise.then(function(orders) {
                            $scope.activeOrders = _.filter(orders, function(it) {
                                return it.isActive();
                            });
                        });*/
                        $timeout(function() {
                            $(".dialog-content:visible button.confirm").focus();
                        }, 10)
                    },
                    template: "templates/confirmDeleteEncounter.page"
                }).then(function() {
                    Encounter.delete({uuid: encounter.uuid})
                        .$promise.then(function() {
                            $scope.reloadVisit();
                        });
                });
            });

            $scope.$on('visit-changed', function(event, visit) {
                if ($scope.visitUuid == visit.uuid) {
                    $scope.reloadVisit();
                }
            });

            $scope.$on('start-consult', function() {

                EncounterTransaction.save({
                    patientUuid: $scope.patientUuid,
                    visitUuid: $scope.visitUuid,
                    locationUuid: SessionInfo.get().sessionLocation.uuid,
                    encounterTypeUuid: VisitTemplateService.getConsultEncounterType().uuid,
                    providers:[ {   "uuid": SessionInfo.get().currentProvider.uuid,
                                    "encounterRoleUuid": EncounterRoles.consultingClinician.uuid } ],
                    encounterDateTime: $scope.visit.stopDatetime ? $scope.visit.startDatetime : ""  // if active visit, set encounterDateTime == "" (ie, null); in this case, the encounter transaction service will timestamp with the current server datetime
                }, function(result) {
                    $scope.consultEncounterUuid = result.encounterUuid;
                    $scope.$broadcast("consult-started", result.encounterUuid);
                })
            })

            $scope.reloadVisit = function() {
                loadVisit($scope.visitUuid);
            }

            $scope.reloadVisits = function() {
                loadVisits($scope.patientUuid);
            }

            $scope.getVisitIdx = function(visit) {
                var idx = -1;
                if (visit != null && typeof $scope.visits !== "undefined" && $scope.visits != null && $scope.visits.length > 0 ) {
                    for (var i=0; i < $scope.visits.length ; i++) {
                        if (visit.uuid == $scope.visits[i].uuid) {
                            idx = i;
                            break;
                        }
                    }
                }
                return idx;
            }

            $scope.previousVisitEndDatetime = function(visit) {
                if ($scope.visitIdx != -1) {
                    if (($scope.visitIdx + 1) == $scope.visits.length) {
                        //this is the oldest visit in the list and the there is no lower date limit
                        return null;
                    } else {
                        var previousVisitEndDate = new Date($filter('serverDate')($scope.visits[$scope.visitIdx + 1].stopDatetime));
                        // return the day after the end date of the previous visit in the list
                        previousVisitEndDate.setDate(previousVisitEndDate.getDate() + 1);
                        return previousVisitEndDate;
                    }
                }
                return null;
            }

            $scope.firstEncounterInVisitDatetime = function(visit) {
                if (visit.encounters != null && visit.encounters.length > 0) {
                    // the visit cannot start after the date of the oldest encounter that is part of this visit
                    return new Date($filter('serverDate')(visit.encounters[visit.encounters.length -1].encounterDatetime));
                }
                else {
                    return null;
                }
            }

            $scope.mostRecentEncounterInVisitDatetime = function(visit) {
                if (visit.encounters != null && visit.encounters.length > 0) {
                    // the visit cannot end before the date of the newest encounter that is part of this visit
                    return new Date($filter('serverDate')(visit.encounters[0].encounterDatetime));
                }
                else {
                    return null;
                }

            }

            $scope.nextVisitStartDatetime = function(visit) {
                if ( $scope.visitIdx != -1) {
                    if ($scope.visitIdx  == 0) {
                        //this is the newest visit in the list and the upper date limit is today
                        return new Date();  // TODO technical is should be "today" in the server's time
                    } else {
                        var nextVisitStartDate = new Date($filter('serverDate')($scope.visits[$scope.visitIdx -1].startDatetime));
                        // return the day before the start date of the next visit in the list
                        nextVisitStartDate.setDate(nextVisitStartDate.getDate() -1);
                        return nextVisitStartDate;
                    }
                }
                return null;
            }

            $scope.goToVisit = function(visit) {
                $scope.visitUuid = visit.uuid;
                $state.go("overview");
            }

            $scope.goToVisitList = function() {
                $state.go("visitList");
            }

           // TODO figure out if we can get rid of this function
            $scope.$watch('visitUuid', function(newVal, oldVal) {
                loadVisit(newVal);
            })


            $scope.visitAction = function(visitAction) {

                if (visitAction.type == 'script') {
                    // TODO
                } else
                {
                    var visitModel = angular.extend({}, $scope.visit);
                    visitModel.id = $scope.visit.uuid; // HACK! TODO: change our extensions to refer to visit.uuid
                    visitModel.active = !$scope.visit.stopDatetime;

                    var returnUrl = window.encodeURIComponent(window.location.pathname + "?visit=" + $scope.visit.uuid);

                    var url = Handlebars.compile(visitAction.url)({
                        visit: visitModel,
                        consultEncounter: $scope.consultEncounter,
                        patient: $scope.visit.patient,
                        returnUrl: returnUrl
                    });

                    // if return hasn't been specified as a template in visitAction.url, make sure we append it
                    if (url.indexOf('returnUrl') == -1) {
                        url = url + "&returnUrl=" + returnUrl;
                    }

                    emr.navigateTo({ applicationUrl: (!url.startsWith("/") ? '/' : '') + url });
                }
            }


            $scope.expandAll = function() {
                $scope.$broadcast("expand-all");
                $scope.allExpanded = true;
            }

            $scope.contractAll = function() {
                $scope.$broadcast("contract-all");
                $scope.allExpanded = false;
            }

            $scope.print = function () {

                if (!$scope.allExpanded) {
                    $scope.printButtonDisabled = true;
                    $scope.expandAll();

                    // wait on digest cycle and for all templates to be loaded (ie, wait for all sections to be fully expanded
                    // see: http://tech.endeepak.com/blog/2014/05/03/waiting-for-angularjs-digest-cycle/
                    var print = function () {
                        if ($http.pendingRequests.length > 0) {
                            $timeout(print); // Wait for all templates to be loaded
                        } else {
                            window.print();
                            $scope.printButtonDisabled = false;
                        }
                    }

                    $timeout(print);
                }
                else {
                    window.print();
                }
            }

            $scope.back = function() {
                window.history.back();
            };

           /* window.onbeforeunload = function() {
                if (OrderContext.hasUnsavedData()) {
                    // TODO: localize
                    return "You have unsaved changes, are you sure you want to discard them?";
                }
            }*/

        }]);