def validate_graph_data(data):
    """Validate graph data structure"""
    required_fields = ['points', 'x_label', 'y_label', 'x_min', 'x_max', 'y_min', 'y_max']
    return all(field in data for field in required_fields)

def combine_graphs(graphs_list):
    """Combine multiple graphs into a single dataset"""
    combined = {
        'points': [],
        'x_label': '',
        'y_label': '',
        'x_min': 0,
        'x_max': 10,
        'y_min': 0,
        'y_max': 10
    }
    
    if graphs_list:
        combined.update({
            'x_label': graphs_list[0].get('x_label', 'X Axis'),
            'y_label': graphs_list[0].get('y_label', 'Y Axis'),
            'x_min': graphs_list[0].get('x_min', 0),
            'x_max': graphs_list[0].get('x_max', 10),
            'y_min': graphs_list[0].get('y_min', 0),
            'y_max': graphs_list[0].get('y_max', 10)
        })
        
        for graph in graphs_list:
            if 'points' in graph:
                combined['points'].extend(graph['points'])
    
    return combined