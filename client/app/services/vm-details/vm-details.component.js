/* eslint camelcase: "off" */
import './_vm-details.sass';
import templateUrl from './vm-details.html';

export const VmDetailsComponent = {
  controller: ComponentController,
  controllerAs: 'vm',
  templateUrl,
};

/** @ngInject */
function ComponentController($stateParams, VmsService, ServicesState, sprintf, lodash,
                             EventNotifications, Polling, PowerOperations, LONG_POLLING_INTERVAL, UsageGraphsService) {
  const vm = this;
  vm.$onInit = activate;
  vm.$onDestroy = onDestroy;
  vm.hasUsageGraphs = true;
  vm.startVm = startVM;
  vm.stopVm = stopVM;
  vm.suspendVM = suspendVM;
  vm.getListActions = getListActions;
  vm.pollVM = pollVM;
  vm.retireVM = retireVM;
  vm.getData = resolveData;
  vm.storageChartConfigOptions = {'units': __('GB'), 'chartId': 'storageChart', 'label': __('used')};
  vm.memoryChartConfigOptions = {'units': __('GB'), 'chartId': 'memoryChart', 'label': __('used')};
  vm.cpuChartConfigOptions = {'units': __('MHz'), 'chartId': 'cpuChart', 'label': __('used')};
  vm.processInstanceVariables = processInstanceVariables;

  // vm.resolveData = resolveData;
  function onDestroy() {
    Polling.stop('vmPolling');
  }

  function activate() {
    vm.permissions = ServicesState.getPermissions();
    angular.extend(vm, {
      hasCustomButtons: hasCustomButtons,
      loading: true,
      neverText: __('Never'),
      noneText: __('None'),
      availableText: __('Available'),
      notAvailable: __("Not Available"),
      vmDetails: {},
      viewType: $stateParams.viewType || 'topologyView',
      viewSelected: viewSelected,
      instance: {},
      cpuChart: UsageGraphsService.getChartConfig(vm.cpuChartConfigOptions),
      memoryChart: UsageGraphsService.getChartConfig(vm.memoryChartConfigOptions),
      storageChart: UsageGraphsService.getChartConfig(vm.storageChartConfigOptions),
      // Config
      headerConfig: {
        actionsConfig: {
          actionsInclude: true,
        },
      },
      listActions: [],
    });

    const ONE_HOUR = 60 * 60 * 1000;
    const ONE_DAY = 24 * ONE_HOUR;
    const ONE_WEEK = 7 * ONE_DAY;
    const ONE_MONTH = 30 * ONE_DAY;
    const today = new Date('2016-05-02T17:59:06.134Z');

    vm.data = [{
      "name": "Alarm/Error",
      "data": [
        {"date": new Date("2016-04-21T01:06:19.126Z"), "details": {"event": "vmPowerOn", "object": "vmName"}},
        {
          "date": new Date("2016-04-16T13:07:15.205Z"),
          "details": {"event": "<a href='google.com'>This is a link</a>", "object": "hostName"},
        },
        {"date": new Date("2016-04-30T20:02:25.693Z"), "details": {"event": "vmPowerOn", "object": "vmName"}},
        {"date": new Date("2016-04-30T20:02:26.664Z"), "details": {"event": "vmPowerUp", "object": "vmNorm"}},
        {"date": new Date("2016-04-30T20:02:27.627Z"), "details": {"event": "vmPowerDown", "object": "vmGnome"}},
        {"date": new Date("2016-04-30T20:02:28.694Z"), "details": {"event": "vmPowerIn", "object": "vmNone"}},
        {"date": new Date("2016-04-30T20:02:28.628Z"), "details": {"event": "vmPowerOut", "object": "vmNoon"}},
        {"date": new Date("2016-04-30T20:02:29.618Z"), "details": {"event": "vmPowerOutage", "object": "vmName"}},
        {"date": new Date("2016-04-30T20:02:25.693Z"), "details": {"event": "vmPowerOn", "object": "vmName"}},
        {"date": new Date("2016-04-07T22:35:41.145Z"), "details": {"event": "vmPowerOff", "object": "hostName"}},
      ],
      "display": true,
    }];
    vm.options = {end: today, start: today - ONE_WEEK, minScale: ONE_WEEK / ONE_MONTH, maxScale: ONE_WEEK / ONE_HOUR};

    EventNotifications.info(__("The contents of this page is a function of the current users's group."));
    resolveData();
    Polling.start('vmPolling', pollVM, LONG_POLLING_INTERVAL);
  }

  // Private
  function startVM() {
    PowerOperations.startVm(vm.vmDetails);
  }

  function stopVM() {
    PowerOperations.stopVm(vm.vmDetails);
  }

  function suspendVM() {
    PowerOperations.suspendVm(vm.vmDetails);
  }

  function retireVM() {
    PowerOperations.retireVM(vm.vmDetails);
  }

  function viewSelected(view) {
    vm.viewType = view;
  }

  function pollVM() {
    resolveData(true);
  }

  function resolveData(refresh) {
    return VmsService.getVm($stateParams.vmId, refresh).then(handleSuccess, handleFailure);

    function handleSuccess(response) {
      vm.vmDetails = response;
      const allocatedStorage = UsageGraphsService.convertBytestoGb(vm.vmDetails.allocated_disk_storage); // convert bytes to gb
      const usedStorage = UsageGraphsService.convertBytestoGb(vm.vmDetails.used_storage);
      const totalMemory = vm.vmDetails.ram_size / 1024;
      const usedMemory = UsageGraphsService.convertBytestoGb(vm.vmDetails.max_mem_usage_absolute_average_avg_over_time_period);
      const usedCPU = vm.vmDetails.cpu_usagemhz_rate_average_avg_over_time_period;
      const totalCPU = (angular.isDefined(vm.vmDetails.hardware.aggregate_cpu_speed) ? vm.vmDetails.hardware.aggregate_cpu_speed : 0);
      if (response.cloud) {
        VmsService.getInstance(response.id).then((response) => {
          vm.instance = response;
          processInstanceVariables(vm.instance);
        });
      }
      hasUsageGraphs();
      vm.vmDetails.lastSyncOn = (angular.isUndefined(vm.vmDetails.last_sync_on) ? vm.neverText : vm.vmDetails.last_sync_on);
      vm.vmDetails.retiresOn = (angular.isUndefined(vm.vmDetails.retires_on) ? vm.neverText : vm.vmDetails.retires_on);
      vm.vmDetails.snapshotCount = defaultText(vm.vmDetails.snapshots);
      vm.vmDetails.resourceAvailability = (vm.vmDetails.template === false ? vm.availableText : vm.noneText);
      vm.vmDetails.driftHistory = defaultText(vm.vmDetails.drift_states);
      vm.vmDetails.scanHistoryCount = defaultText(vm.vmDetails.scan_histories);
      vm.vmDetails.lastComplianceStatus = (angular.isUndefined(vm.vmDetails.last_compliance_status) ? __('Never Verified') : vm.vmDetails.last_compliance_status);
      vm.vmDetails.complianceHistory = (vm.vmDetails.compliances.length > 0 ? vm.availableText : vm.notAvailable);
      vm.vmDetails.provisionDate = angular.isDefined(vm.vmDetails.service.miq_request) ? vm.vmDetails.service.miq_request.fulfilled_on : __('Unknown');
      vm.vmDetails.containerSpecsText = vm.vmDetails.vendor + ': ' + vm.vmDetails.hardware.cpu_total_cores + ' CPUs (' + vm.vmDetails.hardware.cpu_sockets
        + ' sockets x ' + vm.vmDetails.hardware.cpu_cores_per_socket + ' core), ' + vm.vmDetails.hardware.memory_mb + ' MB';
      vm.cpuChart = UsageGraphsService.getChartConfig(vm.cpuChartConfigOptions, usedCPU, totalCPU);
      vm.memoryChart = UsageGraphsService.getChartConfig(vm.memoryChartConfigOptions, usedMemory, totalMemory);
      vm.storageChart = UsageGraphsService.getChartConfig(vm.storageChartConfigOptions, usedStorage, allocatedStorage);
      if (vm.vmDetails.retired) {
        EventNotifications.clearAll(lodash.find(EventNotifications.state().groups, {notificationType: 'warning'}));
        EventNotifications.warn(sprintf(__("%s is a retired resource"), vm.vmDetails.name), {persistent: true, unread: false});
      }
      getListActions();
      hasCustomButtons();
      vm.loading = false;
    }

    function handleFailure(_error) {
      EventNotifications.error(__('There was an error loading the vm details.'));
    }
  }

  function hasCustomButtons() {
    const actions = vm.vmDetails.custom_actions || {};
    const groups = actions.button_groups || [];
    const buttons = [].concat(actions.buttons, ...groups.map((g) => g.buttons));

    return lodash.compact(buttons).length > 0;
  }

  function hasUsageGraphs() {
    if (angular.isUndefined(vm.vmDetails.allocated_disk_storage) || vm.vmDetails.allocated_disk_storage === 0) {
      vm.usageGraphs = false;
    }
    if (angular.isUndefined(vm.vmDetails.max_mem_usage_absolute_average_avg_over_time_period)
      || vm.vmDetails.max_mem_usage_absolute_average_avg_over_time_period === 0) {
      vm.usageGraphs = false;
    }
    if (angular.isUndefined(vm.vmDetails.hardware.aggregate_cpu_speed)
      || vm.vmDetails.hardware.aggregate_cpu_speed === 0) {
      vm.usageGraphs = false;
    }

    return vm.usageGraphs;
  }

  function getListActions() {
    vm.listActions = [];
    const powerOptionsMenu = {
      title: __('Power Operations'),
      name: __('Power'),
      actionName: 'powerOperations',
      icon: 'fa fa-power-off',
      actions: [],
      isDisabled: false,
    };
    const powerOptionsActions = [
      {
        icon: 'fa fa-play',
        name: __('Start'),
        actionName: 'start',
        title: __('Start the Service'),
        actionFn: startVM,
        permission: vm.permissions.instanceStart,
        isDisabled: vm.vmDetails.power_state === 'on',
      }, {
        icon: 'fa fa-stop',
        name: __('Stop'),
        actionName: 'stop',
        title: __('Stop the Service'),
        actionFn: stopVM,
        permission: vm.permissions.instanceStop,
        isDisabled: vm.vmDetails.power_state !== 'on',
      }, {
        icon: 'fa fa-pause',
        name: __('Suspend'),
        actionName: 'suspend',
        title: __('Suspend the Service'),
        actionFn: suspendVM,
        permission: vm.permissions.instanceSuspend,
        isDisabled: vm.vmDetails.power_state !== 'on',
      }, {
        icon: 'fa fa-clock-o',
        name: __('Retire'),
        actionName: 'retire',
        title: __('Retire the Service'),
        actionFn: retireVM,
        permission: vm.permissions.instanceRetire,
        isDisabled: vm.vmDetails.power_state !== 'on',
      },
    ];
    powerOptionsActions.forEach((menuOption) => {
      menuOption.permission ? powerOptionsMenu.actions.push(menuOption) : false;
    });
    powerOptionsMenu.actions.length ? vm.listActions.push(powerOptionsMenu) : false;

    return vm.listActions;
  }

  function defaultText(inputCount, defaultText) {
    const inputArrSize = inputCount.length;
    defaultText = (defaultText === null ? 'None' : defaultText);
    if (inputArrSize === 0) {
      return __(defaultText);
    } else {
      return inputArrSize;
    }
  }


  function processInstanceVariables(data) {
    data.availabilityZone = (angular.isUndefined(data.availability_zone) ? vm.noneText : data.availability_zone.name);
    data.cloudTenant = (angular.isUndefined(data.cloud_tenant) ? vm.noneText : data.cloud_tenant);
    data.orchestrationStack = ( angular.isUndefined(data.orchestration_stack) ? vm.noneText : data.orchestration_stack);
    data.keyPairLabels = [];
    data.key_pairs.forEach(function(keyPair) {
      data.keyPairLabels.push(keyPair.name);
    });

    vm.vmDetails.instance = data;

    return vm.vmDetails.instance;
  }
}
